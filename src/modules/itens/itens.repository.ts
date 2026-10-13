import { db, type ClienteDb } from "@/infra/db";
import type { Prisma } from "@/generated/prisma/client";

import type { Estado, OrigemDimensoes, StatusItem, Unidade } from "./itens.schemas";

const incluir = {
  categoria: { select: { id: true, nome: true } },
  fotos: { select: { chave: true, chaveThumb: true, ordem: true }, orderBy: { ordem: "asc" } },
} satisfies Prisma.ItemInclude;

/** Item com categoria e fotos. `Decimal` é convertido para `number` no service (DTO). */
export type ItemRegistro = Prisma.ItemGetPayload<{ include: typeof incluir }>;

export type DadosNovoItem = {
  utId: string;
  criadoPorId: string;
  categoriaId: string;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  estado: Estado;
  unidade: Unidade;
  quantidade: number;
  valorUnitarioReposicao: number;
  larguraCm: number;
  alturaCm: number;
  profundidadeCm: number;
  pesoKg: number;
  dimensoesOrigem: OrigemDimensoes;
  iaResposta: string | null;
  buscaNormalizada: string;
  status: StatusItem;
  fotos: Array<{ chave: string; chaveThumb: string }>;
};

export type CategoriaDoItem = { id: string; nome: string; ativo: boolean };

export function buscarCategoria(id: string, cliente: ClienteDb = db): Promise<CategoriaDoItem | null> {
  return cliente.categoria.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true } });
}

/** Cria o item e as fotos juntos (a ordem da lista vira `ordem`; 0 = capa). */
export function criar(dados: DadosNovoItem, cliente: ClienteDb = db): Promise<ItemRegistro> {
  const { fotos, quantidade, ...resto } = dados;
  return cliente.item.create({
    data: {
      ...resto,
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

export type DadosEdicaoItem = Omit<
  DadosNovoItem,
  "utId" | "criadoPorId" | "quantidade" | "status" | "dimensoesOrigem" | "iaResposta"
>;

/**
 * Atualiza os dados do item e substitui as fotos pela lista recebida (a ordem vira `ordem`).
 * Chame dentro de uma transação: apaga e recria as fotos.
 */
export async function atualizar(id: string, dados: DadosEdicaoItem, cliente: ClienteDb = db): Promise<ItemRegistro> {
  const { fotos, ...resto } = dados;
  await cliente.itemFoto.deleteMany({ where: { itemId: id } });
  return cliente.item.update({
    where: { id },
    data: { ...resto, fotos: { create: fotos.map((foto, ordem) => ({ ...foto, ordem })) } },
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

/** Itens da UT (todos os status), do mais recente para o mais antigo. */
export function listarPorUt(utId: string, cliente: ClienteDb = db): Promise<ItemRegistro[]> {
  return cliente.item.findMany({
    where: { utId },
    include: incluir,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
  });
}
