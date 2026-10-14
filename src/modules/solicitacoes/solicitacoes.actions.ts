"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import {
  concluirSchema,
  idSolicitacaoSchema,
  listarSolicitacoesSchema,
  recusarSchema,
  solicitarSchema,
  type SolicitacaoDto,
  type SolicitacaoListaDto,
} from "./solicitacoes.schemas";
import * as service from "./solicitacoes.service";

export async function solicitar(entrada: unknown): Promise<Resultado<SolicitacaoDto>> {
  const dados = solicitarSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.solicitar(await exigirUsuarioLogado(), dados.data));
}

export async function aceitar(entrada: unknown): Promise<Resultado<SolicitacaoDto>> {
  const dados = idSolicitacaoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.aceitar(await exigirUsuarioLogado(), dados.data));
}

export async function recusar(entrada: unknown): Promise<Resultado<SolicitacaoDto>> {
  const dados = recusarSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.recusar(await exigirUsuarioLogado(), dados.data));
}

export async function cancelar(entrada: unknown): Promise<Resultado<SolicitacaoDto>> {
  const dados = idSolicitacaoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.cancelar(await exigirUsuarioLogado(), dados.data));
}

export async function concluir(entrada: unknown): Promise<Resultado<SolicitacaoDto>> {
  const dados = concluirSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.concluir(await exigirUsuarioLogado(), dados.data));
}

export async function listarSolicitacoes(entrada: unknown): Promise<Resultado<SolicitacaoListaDto[]>> {
  const dados = listarSolicitacoesSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.listarSolicitacoes(await exigirUsuarioLogado(), dados.data.aba));
}
