import { db, type ClienteDb } from "@/infra/db";

export type UtRegistro = {
  id: string;
  codigo: string;
  nome: string;
  cidade: string;
  uf: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  ativo: boolean;
  criadoEm: Date;
};

export type DadosDaUt = {
  codigo: string;
  nome: string;
  cidade: string;
  uf: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
};

const selecionar = {
  id: true,
  codigo: true,
  nome: true,
  cidade: true,
  uf: true,
  cep: true,
  logradouro: true,
  numero: true,
  complemento: true,
  bairro: true,
  ativo: true,
  criadoEm: true,
} as const;

export function listar(cliente: ClienteDb = db): Promise<UtRegistro[]> {
  return cliente.ut.findMany({ select: selecionar, orderBy: [{ nome: "asc" }, { codigo: "asc" }] });
}

export function listarAtivas(cliente: ClienteDb = db): Promise<UtRegistro[]> {
  return cliente.ut.findMany({
    where: { ativo: true },
    select: selecionar,
    orderBy: [{ nome: "asc" }, { codigo: "asc" }],
  });
}

export function buscarPorId(id: string, cliente: ClienteDb = db): Promise<UtRegistro | null> {
  return cliente.ut.findUnique({ where: { id }, select: selecionar });
}

export function listarAtivasPorIds(ids: string[], cliente: ClienteDb = db): Promise<UtRegistro[]> {
  return cliente.ut.findMany({ where: { id: { in: ids }, ativo: true }, select: selecionar });
}

export function buscarPorCodigo(codigo: string, cliente: ClienteDb = db): Promise<UtRegistro | null> {
  return cliente.ut.findUnique({ where: { codigo }, select: selecionar });
}

export function criar(dados: DadosDaUt, cliente: ClienteDb = db): Promise<UtRegistro> {
  return cliente.ut.create({ data: dados, select: selecionar });
}

export function atualizar(id: string, dados: DadosDaUt, cliente: ClienteDb = db): Promise<UtRegistro> {
  return cliente.ut.update({ where: { id }, data: dados, select: selecionar });
}

export function definirAtivo(id: string, ativo: boolean, cliente: ClienteDb = db): Promise<UtRegistro> {
  return cliente.ut.update({ where: { id }, data: { ativo }, select: selecionar });
}
