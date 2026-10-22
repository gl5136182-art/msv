"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import {
  editarRequisicaoSchema,
  encerrarRequisicaoSchema,
  idRequisicaoSchema,
  requisicaoSchema,
  type FormularioRequisicaoDto,
  type RequisicaoDto,
  type RequisicaoResumoDto,
} from "./requisicoes.schemas";
import * as service from "./requisicoes.service";

export async function criarRequisicao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const dados = requisicaoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.criar(await exigirUsuarioLogado(), dados.data));
}

export async function editarRequisicao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const dados = editarRequisicaoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.editar(await exigirUsuarioLogado(), dados.data));
}

export async function analisarRequisicao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const dados = idRequisicaoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.analisar(await exigirUsuarioLogado(), dados.data));
}

export async function encerrarRequisicao(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const dados = encerrarRequisicaoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.encerrar(await exigirUsuarioLogado(), dados.data));
}

export async function listarRequisicoes(): Promise<Resultado<RequisicaoResumoDto[]>> {
  return executar(async () => service.listarRequisicoes(await exigirUsuarioLogado()));
}

export async function obterRequisicao(entrada: unknown): Promise<Resultado<RequisicaoDto>> {
  const dados = idRequisicaoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.obterRequisicao(await exigirUsuarioLogado(), dados.data.id));
}

export async function obterFormularioRequisicao(entrada: { id?: string } = {}): Promise<Resultado<FormularioRequisicaoDto>> {
  const id = typeof entrada.id === "string" && entrada.id ? entrada.id : undefined;
  return executar(async () => service.obterFormulario(await exigirUsuarioLogado(), id));
}
