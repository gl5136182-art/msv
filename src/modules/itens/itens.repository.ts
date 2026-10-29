import { db, type ClienteDb } from "@/infra/db";
import type { Prisma } from "@/generated/prisma/client";

import type {
  CategoriaItem,
  Estado,
  OrigemDimensoes,
  Segmento,
  StatusItem,
  Unidade,
} from "./itens.schemas";

const incluir = {
  fotos: { select: { chave: true, chaveThumb: true, ordem: true }, orderBy: { ordem: "asc" } },
} satisfies Prisma.ItemInclude;

/** Item com fotos. `Decimal` é convertido para `number` no service (DTO). */
export type ItemRegistro = Prisma.ItemGetPayload<{ include: typeof incluir }>;

export type DadosNovoItem = {
  utId: string;
  criadoPorId: string;
  categoria: CategoriaItem;
  segmento: Segmento;
  rm: string;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  estado: Estado;
  unidade: Unidade;
  quantidade: number;
  valorUnitarioReposicao: number;
  /** Só para a categoria "Ativo"; `null` para "Material". */
  valorDepreciacaoMensal: number | null;
  larguraCm: number | null;
  alturaCm: number | null;
  profundidadeCm: number | null;
  pesoKg: number | null;
  /** As 4 medidas do lote juntas, ou `null`. */
  lote: { larguraCm: number; alturaCm: number; profundidadeCm: number; pesoKg: number } | null;
  dimensoesOrigem: OrigemDimensoes;
  iaResposta: string | null;
  buscaNormalizada: string;
  status: StatusItem;
  fotos: Array<{ chave: string; chaveThumb: string }>;
};

/** Colunas do lote a partir do objeto (os 4 valores ou os 4 nulos). */
function colunasDoLote(lote: DadosNovoItem["lote"]) {
  return {
    larguraLoteCm: lote?.larguraCm ?? null,
    alturaLoteCm: lote?.alturaCm ?? null,
    profundidadeLoteCm: lote?.profundidadeCm ?? null,
    pesoLoteKg: lote?.pesoKg ?? null,
  };
}

/** Cria o item e as fotos juntos (a ordem da lista vira `ordem`; 0 = capa). */
export function criar(dados: DadosNovoItem, cliente: ClienteDb = db): Promise<ItemRegistro> {
  const { fotos, quantidade, lote, ...resto } = dados;
  return cliente.item.create({
    data: {
      ...resto,
      ...colunasDoLote(lote),
      quantidadeTotal: quantidade,
      quantidadeDisponivel: quantidade,
      fotos: { create: fotos.map((foto, ordem) => ({ ...foto, ordem })) },
    },
    include: incluir,
  });
}

export function buscarPorId(id: string, cliente: ClienteDb = db): Promise<ItemRegistro | null> {
  return cliente.item.findUnique({ where: { id }, include: incluir });
}

/** Id do item que já usa o RM (único entre todos os itens, inclusive arquivados). */
export function buscarIdPorRm(rm: string, cliente: ClienteDb = db): Promise<{ id: string } | null> {
  return cliente.item.findUnique({ where: { rm }, select: { id: true } });
}

export type DadosEdicaoItem = Omit<
  DadosNovoItem,
  "utId" | "criadoPorId" | "quantidade" | "status" | "dimensoesOrigem" | "iaResposta"
>;

/**
 * Atualiza os dados do item e substitui as fotos pela lista recebida (a ordem vira `ordem`).
 * Chame dentro de uma transação: apaga e recria as fotos.
 */
export async function atualizar(id: string, dados: DadosEdicaoItem, cliente: ClienteDb = db): Promise<ItemRegistro> {
  const { fotos, lote, ...resto } = dados;
  await cliente.itemFoto.deleteMany({ where: { itemId: id } });
  return cliente.item.update({
    where: { id },
    data: { ...resto, ...colunasDoLote(lote), fotos: { create: fotos.map((foto, ordem) => ({ ...foto, ordem })) } },
    include: incluir,
  });
}

export type DadosQuantidade = {
  quantidadeDisponivel: number;
  quantidadeTotal: number;
  status: StatusItem;
};

export function atualizarQuantidade(id: string, dados: DadosQuantidade, cliente: ClienteDb = db): Promise<ItemRegistro> {
  return cliente.item.update({ where: { id }, data: dados, include: incluir });
}

const incluirVitrine = {
  ut: { select: { id: true, nome: true, cidade: true, uf: true } },
  // Só a capa: o card mostra uma miniatura.
  fotos: { select: { chaveThumb: true }, orderBy: { ordem: "asc" }, take: 1 },
} satisfies Prisma.ItemInclude;

/** Item da vitrine: UT de origem e a miniatura da capa. */
export type ItemVitrineRegistro = Prisma.ItemGetPayload<{ include: typeof incluirVitrine }>;

export type ConsultaVitrine = {
  /** Palavras do termo buscado, já normalizadas (`normalizar`). Todas precisam aparecer. */
  termos: string[];
  categoria?: CategoriaItem;
  segmento?: Segmento;
  uf?: string;
  utId?: string;
  estado?: Estado;
  ordenar: "recentes" | "maior_valor";
  /** Página a partir de 1. */
  pagina: number;
  porPagina: number;
};

/**
 * Itens da vitrine (SPEC §6.3): só `disponivel` e de UT ativa (regra 13). O restante vem dos
 * filtros. A busca compara cada palavra com `busca_normalizada`, sem `mode: 'insensitive'`
 * (CLAUDE.md, Busca). Desempate pelo `id` para a paginação ser estável.
 */
export async function listarVitrine(
  consulta: ConsultaVitrine,
  cliente: ClienteDb = db,
): Promise<{ itens: ItemVitrineRegistro[]; total: number }> {
  const where: Prisma.ItemWhereInput = {
    status: "disponivel",
    ut: { ativo: true, ...(consulta.uf ? { uf: consulta.uf } : {}) },
    ...(consulta.utId ? { utId: consulta.utId } : {}),
    ...(consulta.categoria ? { categoria: consulta.categoria } : {}),
    ...(consulta.segmento ? { segmento: consulta.segmento } : {}),
    ...(consulta.estado ? { estado: consulta.estado } : {}),
    ...(consulta.termos.length > 0
      ? { AND: consulta.termos.map((termo) => ({ buscaNormalizada: { contains: termo } })) }
      : {}),
  };

  const orderBy: Prisma.ItemOrderByWithRelationInput[] =
    consulta.ordenar === "maior_valor"
      ? [{ valorUnitarioReposicao: "desc" }, { criadoEm: "desc" }, { id: "desc" }]
      : [{ criadoEm: "desc" }, { id: "desc" }];

  const [itens, total] = await Promise.all([
    cliente.item.findMany({
      where,
      include: incluirVitrine,
      orderBy,
      skip: (consulta.pagina - 1) * consulta.porPagina,
      take: consulta.porPagina,
    }),
    cliente.item.count({ where }),
  ]);
  return { itens, total };
}

const incluirDetalheVitrine = {
  ut: { select: { id: true, nome: true, cidade: true, uf: true, cep: true } },
  fotos: { select: { chave: true, chaveThumb: true, ordem: true }, orderBy: { ordem: "asc" } },
} satisfies Prisma.ItemInclude;

export type ItemDetalheVitrineRegistro = Prisma.ItemGetPayload<{ include: typeof incluirDetalheVitrine }>;

/** Item que a vitrine mostra: `disponivel` e de UT ativa (mesmo critério da listagem). */
export function buscarDaVitrine(id: string, cliente: ClienteDb = db): Promise<ItemDetalheVitrineRegistro | null> {
  return cliente.item.findFirst({
    where: { id, status: "disponivel", ut: { ativo: true } },
    include: incluirDetalheVitrine,
  });
}

/** Itens das UTs (todos os status), do mais recente para o mais antigo. */
export function listarPorUts(utIds: string[], cliente: ClienteDb = db): Promise<ItemRegistro[]> {
  return cliente.item.findMany({
    where: { utId: { in: utIds } },
    include: incluir,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
  });
}
