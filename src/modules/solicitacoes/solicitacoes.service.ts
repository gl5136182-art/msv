import { db, type ClienteDb } from "@/infra/db";
import { obterUrls } from "@/infra/storage";
import { ErroNegocio } from "@/lib/erro-negocio";
import { exigirPapel } from "@/lib/permissoes";
import { temPapel, utsDoUsuario, vinculadoAUt, type UsuarioLogado } from "@/lib/usuario-logado";
import { calcularAjusteDeQuantidade } from "@/modules/itens/itens.regras";
import { notificarEvento } from "@/modules/notificacoes/notificacoes.service";

import * as repository from "./solicitacoes.repository";
import type { SolicitacaoComItem, SolicitacaoParaLista, SolicitacaoRegistro } from "./solicitacoes.repository";
import { acoesPermitidas } from "./solicitacoes.regras";
import { MOTIVO_ITEM_ESGOTADO, MOTIVO_ITEM_RETIRADO } from "./solicitacoes.schemas";
import type {
  AbaSolicitacoes,
  ConcluirEntrada,
  IdSolicitacaoEntrada,
  RecusarEntrada,
  SolicitacaoDto,
  SolicitacaoListaDto,
  SolicitarEntrada,
} from "./solicitacoes.schemas";

// Solicitações (SPEC §3, regras 5 a 13).

function paraDto(solicitacao: SolicitacaoRegistro): SolicitacaoDto {
  return {
    id: solicitacao.id,
    itemId: solicitacao.itemId,
    solicitanteId: solicitacao.solicitanteId,
    utDestinoId: solicitacao.utDestinoId,
    quantidade: solicitacao.quantidade,
    observacao: solicitacao.observacao,
    status: solicitacao.status,
    criadoEm: solicitacao.criadoEm.toISOString(),
  };
}

/**
 * Solicita um item (SPEC §3, regras 5 e 6). Colaborador ou almoxarife com UT. A UT de destino é
 * uma das UTs do solicitante: a escolhida no modal ou, sem escolha, a única que ele tem. Não debita nada: várias pendentes podem disputar o mesmo item, e a
 * disponibilidade é conferida de novo ao aceitar.
 */
export async function solicitar(usuario: UsuarioLogado, entrada: SolicitarEntrada): Promise<SolicitacaoDto> {
  exigirPapel(usuario, "colaborador", "almoxarife");
  const uts = utsDoUsuario(usuario);
  if (uts.length === 0) {
    throw new ErroNegocio("SEM_UT", "Seu usuário não está vinculado a uma UT. Fale com o administrador.");
  }

  const utDestinoId = entrada.utDestinoId ?? (uts.length === 1 ? uts[0] : undefined);
  if (!utDestinoId) {
    throw new ErroNegocio("UT_DESTINO_OBRIGATORIA", "Selecione a UT de destino.");
  }
  if (!uts.includes(utDestinoId)) {
    throw new ErroNegocio("UT_DESTINO_INVALIDA", "Você não está vinculado a esta UT de destino.");
  }

  const item = await repository.buscarItemParaSolicitar(entrada.itemId);
  if (!item) {
    throw new ErroNegocio("ITEM_NAO_ENCONTRADO", "Item não encontrado.");
  }

  // Regra 5: nem para a própria UT do item, nem de UT inativa.
  if (item.utId === utDestinoId) {
    throw new ErroNegocio("ITEM_DA_PROPRIA_UT", "Você não pode solicitar um item para a UT em que ele já está.");
  }
  if (!item.ut.ativo) {
    throw new ErroNegocio("UT_INATIVA", "A UT deste item está inativa. Não é possível solicitá-lo.");
  }

  if (item.status !== "disponivel" || item.quantidadeDisponivel <= 0) {
    throw new ErroNegocio("ITEM_INDISPONIVEL", "Este item não está mais disponível.");
  }

  // Regra 6: > 0 (o schema garante) e <= disponível agora.
  if (entrada.quantidade > item.quantidadeDisponivel) {
    throw new ErroNegocio(
      "QUANTIDADE_INDISPONIVEL",
      `Quantidade indisponível. Há ${item.quantidadeDisponivel} disponível no momento.`,
    );
  }

  const criada = await repository.criar({
    itemId: item.id,
    solicitanteId: usuario.id,
    utDestinoId,
    quantidade: entrada.quantidade,
    observacao: entrada.observacao ?? null,
    status: "pendente",
  });

  await notificarEvento({
    evento: "nova",
    itemNome: item.nome,
    quantidade: entrada.quantidade,
    unidade: item.unidade,
    solicitanteId: usuario.id,
    solicitanteNome: usuario.nome,
    utOrigemId: item.utId,
  });
  return paraDto(criada);
}

/** Uma solicitação recusada ou cancelada automaticamente: quem pediu e o que foi pedido. */
export type SolicitacaoAfetada = { id: string; solicitanteId: string };

/** Avisa o solicitante de cada solicitação recusada automaticamente (regras 4 e 8). */
async function notificarRecusasAutomaticas(
  itemNome: string,
  recusadas: SolicitacaoAfetada[],
  motivo: string,
): Promise<void> {
  for (const recusada of recusadas) {
    await notificarEvento({ evento: "recusada", itemNome, solicitanteId: recusada.solicitanteId, motivo });
  }
}

/**
 * Carrega a solicitação para responder (aceitar ou recusar, regra 7): ela precisa existir, ser
 * de um item da UT do almoxarife e estar `pendente`.
 */
async function carregarPendenteDaMinhaUt(
  usuario: UsuarioLogado,
  id: string,
  cliente?: ClienteDb,
): Promise<SolicitacaoComItem> {
  const atual = await repository.buscarPorId(id, cliente);
  if (!atual) {
    throw new ErroNegocio("SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada.");
  }
  if (!vinculadoAUt(usuario, atual.item.utId)) {
    throw new ErroNegocio("SEM_PERMISSAO", "Somente o almoxarife da UT de origem pode responder a esta solicitação.");
  }
  if (atual.status !== "pendente") {
    throw new ErroNegocio("SOLICITACAO_NAO_PENDENTE", "Esta solicitação não está mais pendente.");
  }
  return atual;
}

/**
 * Aceita uma solicitação (SPEC §3, regras 7 e 8). Só o almoxarife da UT de origem, em uma
 * transação:
 * 1. marca `aceita` com update condicional (só se ainda `pendente`);
 * 2. debita a quantidade com update condicional (`quantidade_disponivel >= quantidade`);
 * 3. grava o valor de reposição do item naquele momento (`valor_unitario_snapshot`);
 * 4. se o item esgotou, o marca `esgotado` e recusa as demais pendentes ("Item esgotado").
 * Qualquer falha desfaz tudo.
 */
export async function aceitar(
  usuario: UsuarioLogado,
  entrada: IdSolicitacaoEntrada,
  agora: Date = new Date(),
): Promise<SolicitacaoDto> {
  exigirPapel(usuario, "almoxarife");

  const { dto, itemNome, solicitanteId, recusadasPorEsgotar } = await db.$transaction(async (tx) => {
    const atual = await carregarPendenteDaMinhaUt(usuario, entrada.id, tx);

    const aceita = await repository.aceitarSePendente(
      atual.id,
      {
        respondidaPorId: usuario.id,
        respondidaEm: agora,
        valorUnitarioSnapshot: atual.item.valorUnitarioReposicao.toNumber(),
      },
      tx,
    );
    if (!aceita) {
      throw new ErroNegocio("SOLICITACAO_NAO_PENDENTE", "Esta solicitação não está mais pendente.");
    }

    const debitou = await repository.debitarQuantidade(atual.itemId, atual.quantidade, tx);
    if (!debitou) {
      throw new ErroNegocio("QUANTIDADE_INDISPONIVEL", "Quantidade não está mais disponível");
    }

    let recusadasPorEsgotar: SolicitacaoAfetada[] = [];
    const restante = await repository.quantidadeDisponivelDoItem(atual.itemId, tx);
    if (restante === 0) {
      await repository.atualizarStatusDoItem(atual.itemId, "esgotado", tx);
      recusadasPorEsgotar = await repository.recusarPendentesDoItem(
        atual.itemId,
        MOTIVO_ITEM_ESGOTADO,
        agora,
        atual.id,
        tx,
      );
    }

    const aceitaAgora = await repository.buscarPorId(atual.id, tx);
    return {
      dto: paraDto(aceitaAgora!),
      itemNome: atual.item.nome,
      solicitanteId: atual.solicitanteId,
      recusadasPorEsgotar,
    };
  });

  // Depois do commit: notificar nunca desfaz nem quebra a ação.
  await notificarEvento({ evento: "aceita", itemNome, solicitanteId });
  await notificarRecusasAutomaticas(itemNome, recusadasPorEsgotar, MOTIVO_ITEM_ESGOTADO);
  return dto;
}

/**
 * Recusa uma solicitação com motivo (SPEC §3, regra 7). Só o almoxarife da UT de origem.
 * Nada foi debitado enquanto estava pendente, então não há quantidade a devolver.
 */
export async function recusar(
  usuario: UsuarioLogado,
  entrada: RecusarEntrada,
  agora: Date = new Date(),
): Promise<SolicitacaoDto> {
  exigirPapel(usuario, "almoxarife");

  const atual = await carregarPendenteDaMinhaUt(usuario, entrada.id);
  const motivo = entrada.motivo.trim();
  if (motivo === "") {
    throw new ErroNegocio("MOTIVO_OBRIGATORIO", "Informe o motivo da recusa.");
  }

  const recusada = await repository.recusarSePendente(atual.id, {
    motivoRecusa: motivo,
    respondidaPorId: usuario.id,
    respondidaEm: agora,
  });
  if (!recusada) {
    throw new ErroNegocio("SOLICITACAO_NAO_PENDENTE", "Esta solicitação não está mais pendente.");
  }

  await notificarEvento({
    evento: "recusada",
    itemNome: atual.item.nome,
    solicitanteId: atual.solicitanteId,
    motivo,
  });
  return paraDto({ ...atual, status: "recusada", motivoRecusa: motivo, respondidaPorId: usuario.id, respondidaEm: agora });
}

/**
 * Cancela uma solicitação (SPEC §3, regra 9):
 * - o solicitante cancela enquanto `pendente` ou `aceita`;
 * - o almoxarife da UT de origem cancela uma `aceita` (ex.: o item quebrou).
 * Cancelar uma `aceita` devolve a quantidade ao item, que volta a `disponivel` se estava
 * `esgotado` (regra 3); um item `arquivado` continua arquivado.
 */
export async function cancelar(
  usuario: UsuarioLogado,
  entrada: IdSolicitacaoEntrada,
  agora: Date = new Date(),
): Promise<SolicitacaoDto> {
  exigirPapel(usuario, "colaborador", "almoxarife");

  const { dto, atual } = await db.$transaction(async (tx) => {
    const atual = await repository.buscarPorId(entrada.id, tx);
    if (!atual) {
      throw new ErroNegocio("SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada.");
    }

    const ehSolicitante = atual.solicitanteId === usuario.id;
    const ehAlmoxarifeDeOrigem = temPapel(usuario.papel, "almoxarife") && vinculadoAUt(usuario, atual.item.utId);
    if (!ehSolicitante && !ehAlmoxarifeDeOrigem) {
      throw new ErroNegocio("SEM_PERMISSAO", "Você não tem permissão para cancelar esta solicitação.");
    }

    if (atual.status !== "pendente" && atual.status !== "aceita") {
      throw new ErroNegocio("SOLICITACAO_NAO_CANCELAVEL", "Só é possível cancelar solicitações pendentes ou aceitas.");
    }
    if (atual.status === "pendente" && !ehSolicitante) {
      throw new ErroNegocio(
        "SEM_PERMISSAO",
        "Somente quem fez a solicitação pode cancelá-la enquanto está pendente. Use a opção de recusar.",
      );
    }

    const cancelada = await repository.cancelarSeStatus(
      atual.id,
      atual.status,
      { canceladaPorId: usuario.id, canceladaEm: agora },
      tx,
    );
    if (!cancelada) {
      throw new ErroNegocio("SOLICITACAO_MUDOU", "Esta solicitação foi alterada. Atualize a página e tente de novo.");
    }

    // Só a `aceita` debitou a quantidade; a `pendente` nunca mexeu no item.
    if (atual.status === "aceita") {
      const item = await repository.devolverQuantidade(atual.itemId, atual.quantidade, tx);
      const ajuste = calcularAjusteDeQuantidade(
        { quantidadeTotal: item.quantidadeTotal, status: item.status },
        item.quantidadeDisponivel,
      );
      if (ajuste.status !== item.status || ajuste.quantidadeTotal !== item.quantidadeTotal) {
        await repository.atualizarTotalEStatusDoItem(
          atual.itemId,
          { quantidadeTotal: ajuste.quantidadeTotal, status: ajuste.status },
          tx,
        );
      }
    }

    return {
      atual,
      dto: paraDto({ ...atual, status: "cancelada", canceladaPorId: usuario.id, canceladaEm: agora }),
    };
  });

  // Depois do commit: quem cancelou não é avisado; o outro lado sim (SPEC §6.4).
  if (atual.solicitanteId === usuario.id) {
    await notificarEvento({
      evento: "cancelada_pelo_solicitante",
      itemNome: atual.item.nome,
      solicitanteId: usuario.id,
      solicitanteNome: usuario.nome,
      utOrigemId: atual.item.utId,
    });
  } else {
    await notificarEvento({
      evento: "cancelada_pela_origem",
      itemNome: atual.item.nome,
      solicitanteId: atual.solicitanteId,
    });
  }
  return dto;
}

/**
 * Conclui uma solicitação `aceita` (SPEC §3, regras 10 e 11): confirma o recebimento e grava o
 * custo do frete, que a UT de destino paga. Quem confirma é o solicitante ou um almoxarife da
 * UT de destino. A economia só passa a contar a partir daqui.
 */
export async function concluir(
  usuario: UsuarioLogado,
  entrada: ConcluirEntrada,
  agora: Date = new Date(),
): Promise<SolicitacaoDto> {
  exigirPapel(usuario, "colaborador", "almoxarife");

  const atual = await repository.buscarPorId(entrada.id);
  if (!atual) {
    throw new ErroNegocio("SOLICITACAO_NAO_ENCONTRADA", "Solicitação não encontrada.");
  }

  const ehSolicitante = atual.solicitanteId === usuario.id;
  const ehAlmoxarifeDeDestino = temPapel(usuario.papel, "almoxarife") && vinculadoAUt(usuario, atual.utDestinoId);
  if (!ehSolicitante && !ehAlmoxarifeDeDestino) {
    throw new ErroNegocio(
      "SEM_PERMISSAO",
      "Somente quem solicitou ou um almoxarife da UT de destino pode confirmar o recebimento.",
    );
  }
  if (atual.status !== "aceita") {
    throw new ErroNegocio("SOLICITACAO_NAO_ACEITA", "Só é possível concluir uma solicitação aceita.");
  }

  const concluida = await repository.concluirSeAceita(atual.id, {
    custoFrete: entrada.custoFrete,
    concluidaPorId: usuario.id,
    concluidaEm: agora,
  });
  if (!concluida) {
    throw new ErroNegocio("SOLICITACAO_MUDOU", "Esta solicitação foi alterada. Atualize a página e tente de novo.");
  }

  await notificarEvento({
    evento: "concluida",
    itemNome: atual.item.nome,
    atorId: usuario.id,
    atorNome: usuario.nome,
    utOrigemId: atual.item.utId,
  });
  return paraDto({ ...atual, status: "concluida", concluidaPorId: usuario.id, concluidaEm: agora });
}

/**
 * Regra 4: ao arquivar um item, as solicitações `pendentes` dele são recusadas
 * automaticamente ("Item retirado da vitrine"). As `aceitas` seguem normalmente.
 * Chamado pelo service de itens, dentro da transação do arquivamento.
 */
export function recusarPendentesDoItemArquivado(
  itemId: string,
  cliente: ClienteDb,
  agora: Date = new Date(),
): Promise<SolicitacaoAfetada[]> {
  return repository.recusarPendentesDoItem(itemId, MOTIVO_ITEM_RETIRADO, agora, null, cliente);
}

/** Avisa os solicitantes das pendentes recusadas ao arquivar o item. Chamar depois do commit. */
export function notificarRecusasDoItemArquivado(itemNome: string, recusadas: SolicitacaoAfetada[]): Promise<void> {
  return notificarRecusasAutomaticas(itemNome, recusadas, MOTIVO_ITEM_RETIRADO);
}

/**
 * Regra 13: ao desativar uma UT, as solicitações `pendentes` que a envolvem (como origem ou
 * como destino) são canceladas automaticamente. As `aceitas` seguem até a conclusão.
 * Chamado pelo service de UTs, dentro da transação da desativação.
 */
export function cancelarPendentesDaUtDesativada(
  utId: string,
  cliente: ClienteDb,
  agora: Date = new Date(),
): Promise<Array<SolicitacaoAfetada & { itemNome: string }>> {
  return repository.cancelarPendentesDaUt(utId, agora, cliente);
}

/** Avisa os solicitantes das pendentes canceladas ao desativar a UT. Chamar depois do commit. */
export async function notificarCancelamentosDaUtDesativada(
  canceladas: Array<SolicitacaoAfetada & { itemNome: string }>,
): Promise<void> {
  for (const cancelada of canceladas) {
    await notificarEvento({
      evento: "cancelada_automaticamente",
      itemNome: cancelada.itemNome,
      solicitanteId: cancelada.solicitanteId,
    });
  }
}

const VALIDADE_URLS_SEG = 60 * 60;

/** Pendentes primeiro (é o que pede ação); dentro de cada grupo, a ordem do banco (mais recentes). */
function pendentesPrimeiro(lista: SolicitacaoParaLista[]): SolicitacaoParaLista[] {
  return [...lista.filter((s) => s.status === "pendente"), ...lista.filter((s) => s.status !== "pendente")];
}

/**
 * Lista da página Solicitações (SPEC §6.4):
 * - "minhas": enviadas pelas UTs do usuário (colaborador ou almoxarife);
 * - "recebidas": pedidos aos itens das UTs do usuário (só almoxarife).
 * Cada linha traz as ações permitidas ao usuário e, se aceita, os contatos para o transporte.
 */
export async function listarSolicitacoes(
  usuario: UsuarioLogado,
  aba: AbaSolicitacoes,
): Promise<SolicitacaoListaDto[]> {
  if (aba === "recebidas") exigirPapel(usuario, "almoxarife");
  else exigirPapel(usuario, "colaborador", "almoxarife");
  const uts = utsDoUsuario(usuario);
  if (uts.length === 0) return [];

  const registros = pendentesPrimeiro(
    aba === "recebidas"
      ? await repository.listarRecebidasPelasUts(uts)
      : await repository.listarEnviadasPelasUts(uts),
  );

  const capas = registros.map((s) => s.item.fotos[0]?.chaveThumb).filter((c): c is string => Boolean(c));
  const urls = capas.length > 0 ? await obterUrls(capas, VALIDADE_URLS_SEG) : {};

  return registros.map((s) => {
    const capa = s.item.fotos[0]?.chaveThumb;
    return {
      id: s.id,
      status: s.status,
      quantidade: s.quantidade,
      observacao: s.observacao,
      motivoRecusa: s.motivoRecusa,
      criadoEm: s.criadoEm.toISOString(),
      respondidaEm: s.respondidaEm?.toISOString() ?? null,
      concluidaEm: s.concluidaEm?.toISOString() ?? null,
      canceladaEm: s.canceladaEm?.toISOString() ?? null,
      valorUnitario: (s.valorUnitarioSnapshot ?? s.item.valorUnitarioReposicao).toNumber(),
      custoFrete: s.status === "concluida" ? s.custoFrete.toNumber() : null,
      item: {
        id: s.item.id,
        nome: s.item.nome,
        marca: s.item.marca,
        modelo: s.item.modelo,
        rm: s.item.rm,
        unidade: s.item.unidade,
        urlMiniatura: (capa && urls[capa]) || null,
      },
      utOrigem: s.item.ut,
      utDestino: s.utDestino,
      solicitante: { nome: s.solicitante.name },
      contatos:
        s.status === "aceita"
          ? {
              origem: s.respondidaPor
                ? { nome: s.respondidaPor.name, email: s.respondidaPor.email, telefone: s.respondidaPor.telefone }
                : null,
              destino: { nome: s.solicitante.name, email: s.solicitante.email, telefone: s.solicitante.telefone },
            }
          : null,
      acoes: acoesPermitidas(usuario, {
        status: s.status,
        solicitanteId: s.solicitanteId,
        utDestinoId: s.utDestinoId,
        utOrigemId: s.item.utId,
      }),
    };
  });
}

/**
 * Solicitações pendentes por item, para a lista "Meus itens" (SPEC §6.1). Não confere
 * permissão: quem chama (o service de itens) já limitou os ids aos itens da UT do almoxarife.
 */
export function contarPendentesPorItem(itemIds: string[]): Promise<Record<string, number>> {
  return repository.contarPendentesPorItem(itemIds);
}
