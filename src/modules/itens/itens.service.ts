import { db } from "@/infra/db";
import { criarUrlsUpload, obterUrls, remover } from "@/infra/storage";
import { gerarChavesFoto } from "@/lib/chaves-foto";
import { ErroNegocio } from "@/lib/erro-negocio";
import { normalizar } from "@/lib/normalizar";
import { exigirPapel } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/usuario-logado";

import * as repository from "./itens.repository";
import type { ItemRegistro } from "./itens.repository";
import { calcularAjusteDeQuantidade, statusAposArquivamento } from "./itens.regras";
import type {
  AjustarQuantidadeEntrada,
  AlterarArquivamentoEntrada,
  EditarItemEntrada,
  ItemDto,
  ItemEntrada,
  ItemParaEdicaoDto,
  ItemResumoDto,
  PrepararUploadFotosEntrada,
  UploadFotoDto,
} from "./itens.schemas";

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

/** Texto de busca do item: nome + marca + modelo + descrição + categoria, sem acento (SPEC §5). */
export function montarBuscaNormalizada(
  item: { nome: string; marca: string; modelo: string; descricao?: string | null },
  nomeDaCategoria: string,
): string {
  const texto = normalizar([item.nome, item.marca, item.modelo, item.descricao ?? "", nomeDaCategoria].join(" "));
  // A coluna é VarChar(500): o excedente (em geral, o fim de uma descrição longa) fica sem busca.
  return texto.slice(0, LIMITE_BUSCA_NORMALIZADA);
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
    estado: item.estado,
    unidade: item.unidade,
    quantidadeTotal: item.quantidadeTotal,
    quantidadeDisponivel: item.quantidadeDisponivel,
    valorUnitarioReposicao: item.valorUnitarioReposicao.toNumber(),
    larguraCm: item.larguraCm.toNumber(),
    alturaCm: item.alturaCm.toNumber(),
    profundidadeCm: item.profundidadeCm.toNumber(),
    pesoKg: item.pesoKg.toNumber(),
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

  const categoria = await repository.buscarCategoria(entrada.categoriaId);
  if (!categoria || !categoria.ativo) {
    throw new ErroNegocio("CATEGORIA_INVALIDA", "Categoria inválida. Selecione outra.");
  }

  const item = await repository.criar({
    utId: usuario.utId,
    criadoPorId: usuario.id,
    categoriaId: categoria.id,
    nome: entrada.nome,
    marca: entrada.marca,
    modelo: entrada.modelo,
    descricao: entrada.descricao ?? null,
    estado: entrada.estado,
    unidade: entrada.unidade,
    quantidade: entrada.quantidade,
    valorUnitarioReposicao: entrada.valorUnitarioReposicao,
    larguraCm: entrada.larguraCm,
    alturaCm: entrada.alturaCm,
    profundidadeCm: entrada.profundidadeCm,
    pesoKg: entrada.pesoKg,
    dimensoesOrigem: "manual",
    iaResposta: null,
    buscaNormalizada: montarBuscaNormalizada(entrada, categoria.nome),
    status: "disponivel",
    fotos: entrada.fotos,
  });

  return paraDto(item);
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

  const categoria = await repository.buscarCategoria(entrada.categoriaId);
  // Manter a categoria que o item já tem é permitido mesmo desativada (SPEC §6.0).
  if (!categoria || (!categoria.ativo && categoria.id !== atual.categoriaId)) {
    throw new ErroNegocio("CATEGORIA_INVALIDA", "Categoria inválida. Selecione outra.");
  }

  const atualizado = await db.$transaction((tx) =>
    repository.atualizar(
      atual.id,
      {
        categoriaId: categoria.id,
        nome: entrada.nome,
        marca: entrada.marca,
        modelo: entrada.modelo,
        descricao: entrada.descricao ?? null,
        estado: entrada.estado,
        unidade: entrada.unidade,
        valorUnitarioReposicao: entrada.valorUnitarioReposicao,
        larguraCm: entrada.larguraCm,
        alturaCm: entrada.alturaCm,
        profundidadeCm: entrada.profundidadeCm,
        pesoKg: entrada.pesoKg,
        buscaNormalizada: montarBuscaNormalizada(entrada, categoria.nome),
        fotos: entrada.fotos,
      },
      tx,
    ),
  );

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
 * A recusa automática das solicitações pendentes ao arquivar entra com as solicitações (Fase 4).
 */
export async function alterarArquivamento(
  usuario: UsuarioLogado,
  entrada: AlterarArquivamentoEntrada,
): Promise<ItemDto> {
  exigirPapel(usuario, "almoxarife");
  const atual = await buscarItemDaUt(usuario, entrada.id);

  const status = statusAposArquivamento(entrada.arquivar, atual.quantidadeDisponivel);
  if (status === atual.status) return paraDto(atual);

  return paraDto(
    await repository.atualizarQuantidade(atual.id, {
      quantidadeDisponivel: atual.quantidadeDisponivel,
      quantidadeTotal: atual.quantidadeTotal,
      status,
    }),
  );
}

/** "Meus itens": todos os itens da UT do almoxarife, com a miniatura da capa assinada em lote. */
export async function listarItensDaUt(usuario: UsuarioLogado): Promise<ItemResumoDto[]> {
  exigirPapel(usuario, "almoxarife");
  if (!usuario.utId) return [];

  const itens = (await repository.listarPorUt(usuario.utId)).map(paraDto);
  const capas = itens.map((item) => item.fotos[0]?.chaveThumb).filter((chave): chave is string => Boolean(chave));
  const urls = await obterUrls(capas, VALIDADE_URLS_SEG);

  return itens.map((item) => ({
    ...item,
    urlMiniatura: (item.fotos[0] && urls[item.fotos[0].chaveThumb]) || null,
  }));
}
