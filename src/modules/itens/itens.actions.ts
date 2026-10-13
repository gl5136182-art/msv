"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import {
  ajustarQuantidadeSchema,
  alterarArquivamentoSchema,
  editarItemSchema,
  itemSchema,
  prepararUploadFotosSchema,
  type ItemDto,
  type ItemParaEdicaoDto,
  type ItemResumoDto,
  type UploadFotoDto,
} from "./itens.schemas";
import * as service from "./itens.service";

export async function prepararUploadFotos(entrada: unknown): Promise<Resultado<UploadFotoDto[]>> {
  const dados = prepararUploadFotosSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.prepararUploadFotos(await exigirUsuarioLogado(), dados.data));
}

export async function criarItem(entrada: unknown): Promise<Resultado<ItemDto>> {
  const dados = itemSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.criarItem(await exigirUsuarioLogado(), dados.data));
}

export async function editarItem(entrada: unknown): Promise<Resultado<ItemDto>> {
  const dados = editarItemSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.editarItem(await exigirUsuarioLogado(), dados.data));
}

export async function obterItemDaUt(id: string): Promise<Resultado<ItemParaEdicaoDto>> {
  return executar(async () => service.obterItemDaUt(await exigirUsuarioLogado(), id));
}

export async function ajustarQuantidadeDisponivel(entrada: unknown): Promise<Resultado<ItemDto>> {
  const dados = ajustarQuantidadeSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.ajustarQuantidadeDisponivel(await exigirUsuarioLogado(), dados.data));
}

export async function alterarArquivamento(entrada: unknown): Promise<Resultado<ItemDto>> {
  const dados = alterarArquivamentoSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.alterarArquivamento(await exigirUsuarioLogado(), dados.data));
}

export async function listarItensDaUt(): Promise<Resultado<ItemResumoDto[]>> {
  return executar(async () => service.listarItensDaUt(await exigirUsuarioLogado()));
}
