import { db, type ClienteDb } from "@/infra/db";

export type CategoriaRegistro = { id: string; nome: string; ativo: boolean };

const selecionar = { id: true, nome: true, ativo: true } as const;

export function listar(cliente: ClienteDb = db): Promise<CategoriaRegistro[]> {
  return cliente.categoria.findMany({ select: selecionar, orderBy: { nome: "asc" } });
}

export function listarAtivas(cliente: ClienteDb = db): Promise<CategoriaRegistro[]> {
  return cliente.categoria.findMany({ where: { ativo: true }, select: selecionar, orderBy: { nome: "asc" } });
}

export function buscarPorId(id: string, cliente: ClienteDb = db): Promise<CategoriaRegistro | null> {
  return cliente.categoria.findUnique({ where: { id }, select: selecionar });
}

export function criar(nome: string, cliente: ClienteDb = db): Promise<CategoriaRegistro> {
  return cliente.categoria.create({ data: { nome }, select: selecionar });
}

export function renomear(id: string, nome: string, cliente: ClienteDb = db): Promise<CategoriaRegistro> {
  return cliente.categoria.update({ where: { id }, data: { nome }, select: selecionar });
}

export function definirAtivo(id: string, ativo: boolean, cliente: ClienteDb = db): Promise<CategoriaRegistro> {
  return cliente.categoria.update({ where: { id }, data: { ativo }, select: selecionar });
}
