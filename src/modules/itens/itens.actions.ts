"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import {
  ajustarQuantidadeSchema,
  alterarArquivamentoSchema,
  editarItemSchema,
  estimarFreteSchema,
  filtrosVitrineSchema,
  itemSchema,
  prepararUploadFotosSchema,
  type EstimativaFreteDto,
  type ItemDetalheVitrineDto,
  type ItemDto,
  type ItemParaEdicaoDto,
  type ItemResumoDto,
  type PaginaVitrineDto,
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

export async function obterItemDaVitrine(id: string): Promise<Resultado<ItemDetalheVitrineDto>> {
  return executar(async () => service.obterItemDaVitrine(await exigirUsuarioLogado(), id));
}

export async function estimarFrete(entrada: unknown): Promise<Resultado<EstimativaFreteDto>> {
  const dados = estimarFreteSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.estimarFreteDoItem(await exigirUsuarioLogado(), dados.data));
}

/** `entrada` são os parâmetros da URL; o schema ignora o que for inválido (não gera erro). */
export async function listarVitrine(entrada: unknown): Promise<Resultado<PaginaVitrineDto>> {
  const filtros = filtrosVitrineSchema.parse(entrada ?? {});
  return executar(async () => service.listarVitrine(await exigirUsuarioLogado(), filtros));
}
