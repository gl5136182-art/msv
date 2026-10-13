"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import {
  alterarStatusCategoriaSchema,
  categoriaSchema,
  renomearCategoriaSchema,
  type CategoriaDto,
} from "./categorias.schemas";
import * as service from "./categorias.service";

export async function listarCategorias(): Promise<Resultado<CategoriaDto[]>> {
  return executar(async () => service.listarCategorias(await exigirUsuarioLogado()));
}

export async function listarCategoriasAtivas(): Promise<Resultado<CategoriaDto[]>> {
  return executar(async () => service.listarCategoriasAtivas(await exigirUsuarioLogado()));
}

export async function criarCategoria(entrada: unknown): Promise<Resultado<CategoriaDto>> {
  const dados = categoriaSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.criarCategoria(await exigirUsuarioLogado(), dados.data));
}

export async function renomearCategoria(entrada: unknown): Promise<Resultado<CategoriaDto>> {
  const dados = renomearCategoriaSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.renomearCategoria(await exigirUsuarioLogado(), dados.data));
}

export async function alterarStatusCategoria(entrada: unknown): Promise<Resultado<CategoriaDto>> {
  const dados = alterarStatusCategoriaSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.alterarStatusCategoria(await exigirUsuarioLogado(), dados.data));
}
