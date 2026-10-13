"use server";

import { headers } from "next/headers";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, falhaDeValidacao, type Resultado } from "@/lib/erro-negocio";

import {
  alterarStatusUsuarioSchema,
  criarUsuarioSchema,
  editarUsuarioSchema,
  entrarSchema,
  listarUsuariosSchema,
  redefinirSenhaSchema,
  trocarSenhaSchema,
  type CredenciaisGeradasDto,
  type UsuarioAdminDto,
} from "./usuarios.schemas";
import * as service from "./usuarios.service";

// --- Sessão e senha própria --------------------------------------------------------------

/** Login por "E-mail ou CPF" + senha. A tela redireciona quando devolve `{ ok: true }`. */
export async function entrar(entrada: unknown): Promise<Resultado> {
  const dados = entrarSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.entrar(dados.data, { cabecalhos: await headers() }));
}

/** Encerra a sessão. A tela leva o usuário para /login. */
export async function sair(): Promise<Resultado> {
  return executar(async () => service.sair({ cabecalhos: await headers() }));
}

/** Troca a própria senha. Roda também com a troca obrigatória pendente. */
export async function trocarSenha(entrada: unknown): Promise<Resultado> {
  const dados = trocarSenhaSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => {
    const usuario = await exigirUsuarioLogado({ permitirTrocaPendente: true });
    await service.trocarSenha(usuario, dados.data, { cabecalhos: await headers() });
  });
}

// --- Administração (só admin; o service confere o papel) ---------------------------------

export async function listarUsuarios(entrada: unknown = {}): Promise<Resultado<UsuarioAdminDto[]>> {
  const dados = listarUsuariosSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.listarUsuarios(await exigirUsuarioLogado(), dados.data));
}

export async function criarUsuario(entrada: unknown): Promise<Resultado<CredenciaisGeradasDto>> {
  const dados = criarUsuarioSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.criarUsuario(await exigirUsuarioLogado(), dados.data));
}

export async function editarUsuario(entrada: unknown): Promise<Resultado<UsuarioAdminDto>> {
  const dados = editarUsuarioSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.editarUsuario(await exigirUsuarioLogado(), dados.data));
}

export async function redefinirSenha(entrada: unknown): Promise<Resultado<CredenciaisGeradasDto>> {
  const dados = redefinirSenhaSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.redefinirSenha(await exigirUsuarioLogado(), dados.data.id));
}

export async function alterarStatusUsuario(entrada: unknown): Promise<Resultado<UsuarioAdminDto>> {
  const dados = alterarStatusUsuarioSchema.safeParse(entrada);
  if (!dados.success) return falhaDeValidacao(dados.error);

  return executar(async () => service.alterarStatusUsuario(await exigirUsuarioLogado(), dados.data));
}
