"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import {
  alterarStatusUtSchema,
  editarUtSchema,
  listarUtsSchema,
  utSchema,
  type UtDto,
} from "./uts.schemas";
import * as service from "./uts.service";

export async function listarUts(entrada: unknown = {}): Promise<Resultado<UtDto[]>> {
  const dados = listarUtsSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.listarUts(await exigirUsuarioLogado(), dados.data));
}

export async function listarUtsAtivas(): Promise<Resultado<UtDto[]>> {
  return executar(async () => service.listarUtsAtivas(await exigirUsuarioLogado()));
}

export async function criarUt(entrada: unknown): Promise<Resultado<UtDto>> {
  const dados = utSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.criarUt(await exigirUsuarioLogado(), dados.data));
}

export async function editarUt(entrada: unknown): Promise<Resultado<UtDto>> {
  const dados = editarUtSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.editarUt(await exigirUsuarioLogado(), dados.data));
}

export async function alterarStatusUt(entrada: unknown): Promise<Resultado<UtDto>> {
  const dados = alterarStatusUtSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.alterarStatusUt(await exigirUsuarioLogado(), dados.data));
}
