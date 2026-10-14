"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import { marcarLidaSchema, type ListaNotificacoesDto } from "./notificacoes.schemas";
import * as service from "./notificacoes.service";

export async function listarNotificacoes(): Promise<Resultado<ListaNotificacoesDto>> {
  return executar(async () => service.listarNotificacoes(await exigirUsuarioLogado()));
}

export async function marcarComoLida(entrada: unknown): Promise<Resultado<void>> {
  const dados = marcarLidaSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.marcarComoLida(await exigirUsuarioLogado(), dados.data.id));
}

export async function marcarTodasComoLidas(): Promise<Resultado<void>> {
  return executar(async () => service.marcarTodasComoLidas(await exigirUsuarioLogado()));
}
