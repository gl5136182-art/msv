import { db, type ClienteDb } from "@/infra/db";
import type { Prisma } from "@/generated/prisma/client";

import type { StatusRequisicao } from "./requisicoes.schemas";
import type { Unidade } from "@/modules/itens/itens.schemas";

const utResumo = { select: { id: true, nome: true, cidade: true, uf: true } } as const;

const incluirDetalhe = {
  ut: utResumo,
  solicitante: { select: { name: true } },
  linhas: {
    orderBy: { ordem: "asc" },
    include: {
      recomendacoes: {
        orderBy: { ordem: "asc" },
        include: {
          item: {
            select: {
              id: true,
              nome: true,
              marca: true,
              modelo: true,
              rm: true,
              estado: true,
              unidade: true,
              status: true,
              quantidadeDisponivel: true,
              ut: { select: { id: true, nome: true, cidade: true, uf: true, ativo: true } },
              fotos: { select: { chaveThumb: true }, orderBy: { ordem: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RequisicaoInclude;

/** Requisição com linhas, recomendações e a situação atual de cada item recomendado. */
export type RequisicaoDetalhe = Prisma.RequisicaoGetPayload<{ include: typeof incluirDetalhe }>;

export function buscarPorId(id: string, cliente: ClienteDb = db): Promise<RequisicaoDetalhe | null> {
  return cliente.requisicao.findUnique({ where: { id }, include: incluirDetalhe });
}

const incluirLista = {
  ut: utResumo,
  solicitante: { select: { name: true } },
  linhas: { select: { quantidade: true, recomendacoes: { select: { quantidadeSugerida: true } } } },
} satisfies Prisma.RequisicaoInclude;

export type RequisicaoParaLista = Prisma.RequisicaoGetPayload<{ include: typeof incluirLista }>;

/**
 * Requisições visíveis: as do solicitante e as das UTs indicadas; `todas` ignora os filtros
 * (admin). Mais recentes primeiro.
 */
export function listar(
  filtro: { solicitanteId: string; utIds: string[]; todas: boolean },
  cliente: ClienteDb = db,
): Promise<RequisicaoParaLista[]> {
  const where: Prisma.RequisicaoWhereInput = filtro.todas
    ? {}
    : {
        OR: [
          { solicitanteId: filtro.solicitanteId },
          ...(filtro.utIds.length > 0 ? [{ utId: { in: filtro.utIds }, status: { not: "rascunho" as const } }] : []),
        ],
      };
  return cliente.requisicao.findMany({
    where,
    include: incluirLista,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: 200,
  });
}

export type DadosLinha = { descricao: string; quantidade: number; unidade: Unidade; observacao: string | null };

export type DadosNovaRequisicao = {
  solicitanteId: string;
  utId: string;
  justificativa: string | null;
  status: StatusRequisicao;
  linhas: DadosLinha[];
};

export function criar(dados: DadosNovaRequisicao, cliente: ClienteDb = db): Promise<{ id: string }> {
  const { linhas, ...resto } = dados;
  return cliente.requisicao.create({
    data: { ...resto, linhas: { create: linhas.map((linha, ordem) => ({ ...linha, ordem })) } },
    select: { id: true },
  });
}

/** Troca cabeçalho e linhas do rascunho (as linhas antigas e suas recomendações saem). */
export async function substituirRascunho(
  id: string,
  dados: Omit<DadosNovaRequisicao, "solicitanteId">,
  cliente: ClienteDb,
): Promise<boolean> {
  const { linhas, ...resto } = dados;
  const { count } = await cliente.requisicao.updateMany({ where: { id, status: "rascunho" }, data: resto });
  if (count !== 1) return false;
  await cliente.requisicaoLinha.deleteMany({ where: { requisicaoId: id } });
  await cliente.requisicaoLinha.createMany({
    data: linhas.map((linha, ordem) => ({ ...linha, ordem, requisicaoId: id })),
  });
  return true;
}

export type DadosRecomendacao = {
  linhaId: string;
  itemId: string;
  quantidadeSugerida: number;
  aderencia: string;
  justificativa: string;
  ordem: number;
};

/** Grava o resultado de uma análise: apaga as recomendações anteriores e cria as novas. */
export async function gravarAnalise(
  id: string,
  dados: { recomendacoes: DadosRecomendacao[]; analisadaEm: Date; analiseComIa: boolean; status: StatusRequisicao },
  cliente: ClienteDb,
): Promise<void> {
  await cliente.requisicaoRecomendacao.deleteMany({ where: { linha: { requisicaoId: id } } });
  if (dados.recomendacoes.length > 0) {
    await cliente.requisicaoRecomendacao.createMany({ data: dados.recomendacoes });
  }
  await cliente.requisicao.update({
    where: { id },
    data: { analisadaEm: dados.analisadaEm, analiseComIa: dados.analiseComIa, status: dados.status },
  });
}

/** Muda o status só se ainda estiver em um dos `de` (update condicional). */
export async function mudarStatusSe(
  id: string,
  de: StatusRequisicao[],
  para: StatusRequisicao,
  cliente: ClienteDb = db,
): Promise<boolean> {
  const { count } = await cliente.requisicao.updateMany({ where: { id, status: { in: de } }, data: { status: para } });
  return count === 1;
}

/** Requisições do usuário analisadas desde `desde` (limite diário de uso da IA). */
export function contarAnalisadasDesde(solicitanteId: string, desde: Date, cliente: ClienteDb = db): Promise<number> {
  return cliente.requisicao.count({ where: { solicitanteId, analisadaEm: { gte: desde } } });
}
