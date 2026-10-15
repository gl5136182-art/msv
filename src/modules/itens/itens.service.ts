import { db } from "@/infra/db";
import { criarUrlsUpload, obterUrls, remover } from "@/infra/storage";
import { gerarChavesFoto } from "@/lib/chaves-foto";
import { ErroNegocio } from "@/lib/erro-negocio";
import { normalizar } from "@/lib/normalizar";
import { exigirPapel } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/usuario-logado";

import {
  contarPendentesPorItem,
  notificarRecusasDoItemArquivado,
  recusarPendentesDoItemArquivado,
} from "@/modules/solicitacoes/solicitacoes.service";

import * as repository from "./itens.repository";
import type { DadosNovoItem, ItemRegistro } from "./itens.repository";
import { calcularAjusteDeQuantidade, statusAposArquivamento } from "./itens.regras";
import type {
  AjustarQuantidadeEntrada,
  AlterarArquivamentoEntrada,
  CategoriaItem,
  EditarItemEntrada,
  FiltrosVitrine,
  ItemDto,
  ItemDetalheVitrineDto,
  ItemEntrada,
  ItemParaEdicaoDto,
  ItemResumoDto,
  MedidasLoteDto,
  PaginaVitrineDto,
  PrepararUploadFotosEntrada,
  Segmento,
  UploadFotoDto,
} from "./itens.schemas";
import { ITENS_POR_PAGINA_VITRINE, ROTULO_CATEGORIA, ROTULO_SEGMENTO } from "./itens.schemas";

// Itens (SPEC §6.1). Só o almoxarife cadastra e edita; a UT vem da sessão.

/**
 * Reserva as chaves e gera as URLs assinadas para o navegador enviar as fotos direto ao
 * storage (principal + miniatura de cada foto). Nada é gravado no banco aqui: as chaves só
 * entram no item quando ele é salvo. Arquivos de cadastros abandonados ficam órfãos (SPEC §6.1).
 */
export async function prepararUploadFotos(
  usuario: UsuarioLogado,
  entrada: PrepararUploadFotosEntrada,
  agora: Date = new Date(),
): Promise<UploadFotoDto[]> {
  exigirPapel(usuario, "almoxarife");

  const fotos = Array.from({ length: entrada.quantidade }, () => gerarChavesFoto(agora));
  const urls = await criarUrlsUpload(fotos.flatMap((f) => [f.chave, f.chaveThumb]));
  const urlPorChave = new Map(urls.map((u) => [u.chave, u.url]));

  return fotos.map((f) => ({
    chave: f.chave,
    urlUpload: urlPorChave.get(f.chave)!,
    chaveThumb: f.chaveThumb,
    urlUploadThumb: urlPorChave.get(f.chaveThumb)!,
  }));
}

const LIMITE_BUSCA_NORMALIZADA = 500;

/**
 * Texto de busca do item, sem acento (SPEC §5): nome + marca + modelo + RM + categoria +
 * segmento + descrição. A descrição vai por último porque é o que o corte dos 500 caracteres
 * leva embora quando ela é longa.
 */
export function montarBuscaNormalizada(item: {
  nome: string;
  marca: string;
  modelo: string;
  /** `null` nos itens importados do inventário que ainda não têm RM. */
  rm: string | null;
  categoria: CategoriaItem;
  segmento: Segmento;
  descricao?: string | null;
}): string {
  const texto = normalizar(
    [
      item.nome,
      item.marca,
      item.modelo,
      item.rm ?? "",
      ROTULO_CATEGORIA[item.categoria],
      ROTULO_SEGMENTO[item.segmento],
      item.descricao ?? "",
    ].join(" "),
  );
  // A coluna é VarChar(500): o excedente (em geral, o fim de uma descrição longa) fica sem busca.
  return texto.slice(0, LIMITE_BUSCA_NORMALIZADA);
}

function decimalOuNulo(valor: { toNumber(): number } | null): number | null {
  return valor === null ? null : valor.toNumber();
}

/** As 4 colunas do lote viram um objeto (ou `null` quando não foi informado). */
function loteDoRegistro(item: {
  larguraLoteCm: { toNumber(): number } | null;
  alturaLoteCm: { toNumber(): number } | null;
  profundidadeLoteCm: { toNumber(): number } | null;
  pesoLoteKg: { toNumber(): number } | null;
}): MedidasLoteDto | null {
  if (!item.larguraLoteCm || !item.alturaLoteCm || !item.profundidadeLoteCm || !item.pesoLoteKg) return null;
  return {
    larguraCm: item.larguraLoteCm.toNumber(),
    alturaCm: item.alturaLoteCm.toNumber(),
    profundidadeCm: item.profundidadeLoteCm.toNumber(),
    pesoKg: item.pesoLoteKg.toNumber(),
  };
}

/** O lote da entrada (os 4 campos juntos, já validados pelo schema) como objeto, ou `null`. */
function loteDaEntrada(entrada: {
  larguraLoteCm?: number;
  alturaLoteCm?: number;
  profundidadeLoteCm?: number;
  pesoLoteKg?: number;
}): DadosNovoItem["lote"] {
  const { larguraLoteCm, alturaLoteCm, profundidadeLoteCm, pesoLoteKg } = entrada;
  if (
    larguraLoteCm === undefined ||
    alturaLoteCm === undefined ||
    profundidadeLoteCm === undefined ||
    pesoLoteKg === undefined
  ) {
    return null;
  }
  return { larguraCm: larguraLoteCm, alturaCm: alturaLoteCm, profundidadeCm: profundidadeLoteCm, pesoKg: pesoLoteKg };
}

export function paraDto(item: ItemRegistro): ItemDto {
  return {
    id: item.id,
    utId: item.utId,
    nome: item.nome,
    marca: item.marca,
    modelo: item.modelo,
    descricao: item.descricao,
    categoria: item.categoria,
    segmento: item.segmento,
    rm: item.rm,
    estado: item.estado,
    unidade: item.unidade,
    quantidadeTotal: item.quantidadeTotal,
    quantidadeDisponivel: item.quantidadeDisponivel,
    valorUnitarioReposicao: item.valorUnitarioReposicao.toNumber(),
    valorDepreciacaoMensal: decimalOuNulo(item.valorDepreciacaoMensal),
    larguraCm: decimalOuNulo(item.larguraCm),
    alturaCm: decimalOuNulo(item.alturaCm),
    profundidadeCm: decimalOuNulo(item.profundidadeCm),
    pesoKg: decimalOuNulo(item.pesoKg),
    lote: loteDoRegistro(item),
    dimensoesOrigem: item.dimensoesOrigem,
    status: item.status,
    criadoEm: item.criadoEm.toISOString(),
    fotos: item.fotos,
  };
}

/**
 * Cadastra um item (SPEC §6.1). Só o almoxarife; a UT vem da sessão, nunca da entrada.
 * Quantidade inicial = total = disponível. Dimensões e peso são `manual` até a recomendação
 * da IA existir (Fase 5).
 */
export async function criarItem(usuario: UsuarioLogado, entrada: ItemEntrada): Promise<ItemDto> {
  exigirPapel(usuario, "almoxarife");
  if (!usuario.utId) {
    throw new ErroNegocio("SEM_UT", "Seu usuário não está vinculado a uma UT. Fale com o administrador.");
  }

  await exigirRmLivre(entrada.rm, null);

  try {
    const item = await repository.criar({
      utId: usuario.utId,
      criadoPorId: usuario.id,
      categoria: entrada.categoria,
      segmento: entrada.segmento,
      rm: entrada.rm,
      nome: entrada.nome,
      marca: entrada.marca,
      modelo: entrada.modelo,
      descricao: entrada.descricao ?? null,
      estado: entrada.estado,
      unidade: entrada.unidade,
      quantidade: entrada.quantidade,
      valorUnitarioReposicao: entrada.valorUnitarioReposicao,
      valorDepreciacaoMensal: depreciacaoDaEntrada(entrada),
      larguraCm: entrada.larguraCm ?? null,
      alturaCm: entrada.alturaCm ?? null,
      profundidadeCm: entrada.profundidadeCm ?? null,
      pesoKg: entrada.pesoKg ?? null,
      lote: loteDaEntrada(entrada),
      dimensoesOrigem: "manual",
      iaResposta: null,
      buscaNormalizada: montarBuscaNormalizada(entrada),
      status: "disponivel",
      fotos: entrada.fotos,
    });
    return paraDto(item);
  } catch (erro) {
    throw traduzirErroDeRmDuplicado(erro);
  }
}

const MENSAGEM_RM_DUPLICADO = "Já existe um item cadastrado com este RM.";

/** O RM é único entre todos os itens (SPEC §5). `idAtual` é o item em edição, que pode manter o próprio RM. */
async function exigirRmLivre(rm: string, idAtual: string | null): Promise<void> {
  const existente = await repository.buscarIdPorRm(rm);
  if (existente && existente.id !== idAtual) {
    throw new ErroNegocio("RM_DUPLICADO", MENSAGEM_RM_DUPLICADO);
  }
}

// Última barreira: o índice único do banco (P2002) para dois cadastros simultâneos com o mesmo RM.
function traduzirErroDeRmDuplicado(erro: unknown): unknown {
  const codigo = typeof erro === "object" && erro !== null && "code" in erro ? erro.code : undefined;
  return codigo === "P2002" ? new ErroNegocio("RM_DUPLICADO", MENSAGEM_RM_DUPLICADO) : erro;
}

/** Depreciação mensal só existe para "Ativo" (o schema já descarta a de "Material"; aqui é a garantia). */
function depreciacaoDaEntrada(entrada: { categoria: CategoriaItem; valorDepreciacaoMensal?: number }): number | null {
  return entrada.categoria === "ativo" ? (entrada.valorDepreciacaoMensal ?? null) : null;
}

/** Busca o item e confere que ele é da UT do almoxarife (regra 1: o item pertence à UT). */
async function buscarItemDaUt(usuario: UsuarioLogado, id: string): Promise<ItemRegistro> {
  const item = await repository.buscarPorId(id);
  if (!item) {
    throw new ErroNegocio("ITEM_NAO_ENCONTRADO", "Item não encontrado.");
  }
  if (item.utId !== usuario.utId) {
    throw new ErroNegocio("SEM_PERMISSAO", "Você só pode alterar itens da sua UT.");
  }
  return item;
}

const VALIDADE_URLS_SEG = 60 * 60;

/** Item da UT do almoxarife, com as miniaturas assinadas, para a tela de edição. */
export async function obterItemDaUt(usuario: UsuarioLogado, id: string): Promise<ItemParaEdicaoDto> {
  exigirPapel(usuario, "almoxarife");
  const item = paraDto(await buscarItemDaUt(usuario, id));
  const previas = await obterUrls(
    item.fotos.map((f) => f.chaveThumb),
    VALIDADE_URLS_SEG,
  );
  return { ...item, previas };
}

/**
 * Edita os dados e as fotos do item (SPEC §6.1, item 7). Só o almoxarife da UT do item.
 * A quantidade e o status têm ações próprias. Fotos que saíram da lista são removidas do
 * storage depois de gravar; falha na remoção não desfaz a edição (vira arquivo órfão).
 */
export async function editarItem(usuario: UsuarioLogado, entrada: EditarItemEntrada): Promise<ItemDto> {
  exigirPapel(usuario, "almoxarife");
  const atual = await buscarItemDaUt(usuario, entrada.id);

  await exigirRmLivre(entrada.rm, atual.id);

  let atualizado: ItemRegistro;
  try {
    atualizado = await db.$transaction((tx) =>
      repository.atualizar(
        atual.id,
        {
          categoria: entrada.categoria,
          segmento: entrada.segmento,
          rm: entrada.rm,
          nome: entrada.nome,
          marca: entrada.marca,
          modelo: entrada.modelo,
          descricao: entrada.descricao ?? null,
          estado: entrada.estado,
          unidade: entrada.unidade,
          valorUnitarioReposicao: entrada.valorUnitarioReposicao,
          valorDepreciacaoMensal: depreciacaoDaEntrada(entrada),
          larguraCm: entrada.larguraCm ?? null,
          alturaCm: entrada.alturaCm ?? null,
          profundidadeCm: entrada.profundidadeCm ?? null,
          pesoKg: entrada.pesoKg ?? null,
          lote: loteDaEntrada(entrada),
          buscaNormalizada: montarBuscaNormalizada(entrada),
          fotos: entrada.fotos,
        },
        tx,
      ),
    );
  } catch (erro) {
    throw traduzirErroDeRmDuplicado(erro);
  }

  const mantidas = new Set(entrada.fotos.flatMap((f) => [f.chave, f.chaveThumb]));
  const removidas = atual.fotos.flatMap((f) => [f.chave, f.chaveThumb]).filter((chave) => !mantidas.has(chave));
  if (removidas.length > 0) {
    try {
      await remover(removidas);
    } catch (erro) {
      console.error("Falha ao remover fotos antigas do item", atual.id, erro instanceof Error ? erro.message : erro);
    }
  }

  return paraDto(atualizado);
}

/**
 * Ajusta a quantidade disponível (SPEC §3, regras 2 e 3). Só o almoxarife da UT do item.
 * Solicitações já aceitas não são afetadas: elas já debitaram a quantidade ao serem aceitas.
 * Passar do total cadastrado sobe o total junto; 0 esgota o item; voltar a > 0 reativa.
 */
export async function ajustarQuantidadeDisponivel(
  usuario: UsuarioLogado,
  entrada: AjustarQuantidadeEntrada,
): Promise<ItemDto> {
  exigirPapel(usuario, "almoxarife");
  const atual = await buscarItemDaUt(usuario, entrada.id);

  const ajuste = calcularAjusteDeQuantidade(
    { quantidadeTotal: atual.quantidadeTotal, status: atual.status },
    entrada.quantidadeDisponivel,
  );
  return paraDto(await repository.atualizarQuantidade(atual.id, ajuste));
}

/**
 * Arquiva ou reativa o item (SPEC §3, regra 4). Só o almoxarife da UT do item.
 * Arquivado sai da vitrine; reativar volta a `disponivel` (ou `esgotado`, se não há unidades).
 * Ao arquivar, as solicitações pendentes do item são recusadas na mesma transação.
 */
export async function alterarArquivamento(
  usuario: UsuarioLogado,
  entrada: AlterarArquivamentoEntrada,
): Promise<ItemDto> {
  exigirPapel(usuario, "almoxarife");
  const atual = await buscarItemDaUt(usuario, entrada.id);

  const status = statusAposArquivamento(entrada.arquivar, atual.quantidadeDisponivel);
  if (status === atual.status) return paraDto(atual);

  // Arquivar e recusar as pendentes (regra 4) valem juntos ou nenhum dos dois.
  const { atualizado, recusadas } = await db.$transaction(async (tx) => {
    const item = await repository.atualizarQuantidade(
      atual.id,
      {
        quantidadeDisponivel: atual.quantidadeDisponivel,
        quantidadeTotal: atual.quantidadeTotal,
        status,
      },
      tx,
    );
    const recusadas = entrada.arquivar ? await recusarPendentesDoItemArquivado(atual.id, tx) : [];
    return { atualizado: item, recusadas };
  });

  // Depois do commit: avisar os solicitantes nunca desfaz nem quebra o arquivamento.
  await notificarRecusasDoItemArquivado(atual.nome, recusadas);
  return paraDto(atualizado);
}

const MAXIMO_TERMOS_BUSCA = 8;

/**
 * Vitrine (SPEC §6.3): itens `disponivel` de UTs ativas, para qualquer usuário logado.
 * A busca exige todas as palavras digitadas (sem acento, sem caixa). As miniaturas das capas
 * são assinadas de uma vez, válidas por 1h. Itens da própria UT vêm marcados (`daMinhaUt`).
 */
export async function listarVitrine(usuario: UsuarioLogado, filtros: FiltrosVitrine): Promise<PaginaVitrineDto> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");

  const termos = normalizar(filtros.busca ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, MAXIMO_TERMOS_BUSCA);

  const consulta = {
    termos,
    categoria: filtros.categoria,
    segmento: filtros.segmento,
    uf: filtros.uf,
    utId: filtros.utId,
    estado: filtros.estado,
    ordenar: filtros.ordenar,
    pagina: filtros.pagina,
    porPagina: ITENS_POR_PAGINA_VITRINE,
  };

  let { itens, total } = await repository.listarVitrine(consulta);
  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA_VITRINE));

  // Página além do fim (URL antiga, filtro mais restrito): mostra a última em vez de uma lista vazia.
  let pagina = filtros.pagina;
  if (pagina > totalPaginas) {
    pagina = totalPaginas;
    ({ itens, total } = await repository.listarVitrine({ ...consulta, pagina }));
  }

  const capas = itens.map((item) => item.fotos[0]?.chaveThumb).filter((chave): chave is string => Boolean(chave));
  const urls = capas.length > 0 ? await obterUrls(capas, VALIDADE_URLS_SEG) : {};

  return {
    itens: itens.map((item) => ({
      id: item.id,
      nome: item.nome,
      marca: item.marca,
      modelo: item.modelo,
      rm: item.rm,
      categoria: item.categoria,
      segmento: item.segmento,
      estado: item.estado,
      unidade: item.unidade,
      quantidadeDisponivel: item.quantidadeDisponivel,
      valorUnitarioReposicao: item.valorUnitarioReposicao.toNumber(),
      ut: item.ut,
      daMinhaUt: usuario.utId !== null && item.utId === usuario.utId,
      urlMiniatura: (item.fotos[0] && urls[item.fotos[0].chaveThumb]) || null,
    })),
    total,
    pagina,
    totalPaginas,
    porPagina: ITENS_POR_PAGINA_VITRINE,
  };
}

/**
 * Detalhe do item na vitrine (SPEC §6.3). Qualquer usuário logado vê item `disponivel` de UT
 * ativa; fora disso o item "não existe" para a vitrine. Fotos assinadas em lote, válidas por 1h.
 */
export async function obterItemDaVitrine(usuario: UsuarioLogado, id: string): Promise<ItemDetalheVitrineDto> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");

  const item = await repository.buscarDaVitrine(id);
  if (!item) {
    throw new ErroNegocio("ITEM_NAO_ENCONTRADO", "Item não encontrado ou não está mais disponível.");
  }

  const urls = await obterUrls(
    item.fotos.flatMap((f) => [f.chave, f.chaveThumb]),
    VALIDADE_URLS_SEG,
  );
  const daMinhaUt = usuario.utId !== null && item.utId === usuario.utId;

  return {
    id: item.id,
    nome: item.nome,
    marca: item.marca,
    modelo: item.modelo,
    descricao: item.descricao,
    rm: item.rm,
    categoria: item.categoria,
    segmento: item.segmento,
    estado: item.estado,
    unidade: item.unidade,
    quantidadeDisponivel: item.quantidadeDisponivel,
    valorUnitarioReposicao: item.valorUnitarioReposicao.toNumber(),
    valorDepreciacaoMensal: decimalOuNulo(item.valorDepreciacaoMensal),
    larguraCm: decimalOuNulo(item.larguraCm),
    alturaCm: decimalOuNulo(item.alturaCm),
    profundidadeCm: decimalOuNulo(item.profundidadeCm),
    pesoKg: decimalOuNulo(item.pesoKg),
    lote: loteDoRegistro(item),
    dimensoesOrigem: item.dimensoesOrigem,
    criadoEm: item.criadoEm.toISOString(),
    ut: item.ut,
    daMinhaUt,
    podeSolicitar: usuario.papel !== "admin" && !daMinhaUt,
    fotos: item.fotos.map((f) => ({
      urlPrincipal: urls[f.chave] ?? null,
      urlMiniatura: urls[f.chaveThumb] ?? null,
    })),
  };
}

/** "Meus itens": todos os itens da UT do almoxarife, com a miniatura da capa assinada em lote. */
export async function listarItensDaUt(usuario: UsuarioLogado): Promise<ItemResumoDto[]> {
  exigirPapel(usuario, "almoxarife");
  if (!usuario.utId) return [];

  const itens = (await repository.listarPorUt(usuario.utId)).map(paraDto);
  const capas = itens.map((item) => item.fotos[0]?.chaveThumb).filter((chave): chave is string => Boolean(chave));
  const [urls, pendentes] = await Promise.all([
    obterUrls(capas, VALIDADE_URLS_SEG),
    contarPendentesPorItem(itens.map((item) => item.id)),
  ]);

  return itens.map((item) => ({
    ...item,
    urlMiniatura: (item.fotos[0] && urls[item.fotos[0].chaveThumb]) || null,
    solicitacoesPendentes: pendentes[item.id] ?? 0,
  }));
}
