import { db, type ClienteDb } from "@/infra/db";
import type { Papel } from "@/lib/usuario-logado";

// --- Login -------------------------------------------------------------------------------

export type CredencialDeLogin = { email: string; ativo: boolean };

const selecionarLogin = { email: true, ativo: true } as const;

export function buscarLoginPorCpf(cpf: string, cliente: ClienteDb = db): Promise<CredencialDeLogin | null> {
  return cliente.usuario.findUnique({ where: { cpf }, select: selecionarLogin });
}

export function buscarLoginPorEmail(email: string, cliente: ClienteDb = db): Promise<CredencialDeLogin | null> {
  return cliente.usuario.findUnique({ where: { email }, select: selecionarLogin });
}

export async function marcarSenhaComoTrocada(usuarioId: string, cliente: ClienteDb = db): Promise<void> {
  await cliente.usuario.update({ where: { id: usuarioId }, data: { deveTrocarSenha: false } });
}

// --- Administração -----------------------------------------------------------------------

export type UsuarioRegistro = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  telefone: string | null;
  papel: Papel;
  utId: string | null;
  ativo: boolean;
  deveTrocarSenha: boolean;
  createdAt: Date;
  ut: { nome: string; cidade: string; uf: string } | null;
};

export type NovoUsuario = {
  id: string;
  name: string;
  email: string;
  cpf: string;
  telefone: string | null;
  papel: Papel;
  utId: string | null;
};

const selecionarRegistro = {
  id: true,
  name: true,
  email: true,
  cpf: true,
  telefone: true,
  papel: true,
  utId: true,
  ativo: true,
  deveTrocarSenha: true,
  createdAt: true,
  ut: { select: { nome: true, cidade: true, uf: true } },
} as const;

export function listar(cliente: ClienteDb = db): Promise<UsuarioRegistro[]> {
  return cliente.usuario.findMany({ select: selecionarRegistro, orderBy: [{ name: "asc" }] });
}

export function buscarPorId(id: string, cliente: ClienteDb = db): Promise<UsuarioRegistro | null> {
  return cliente.usuario.findUnique({ where: { id }, select: selecionarRegistro });
}

export async function existeComEmail(email: string, cliente: ClienteDb = db): Promise<boolean> {
  return (await cliente.usuario.count({ where: { email } })) > 0;
}

export async function existeComCpf(cpf: string, cliente: ClienteDb = db): Promise<boolean> {
  return (await cliente.usuario.count({ where: { cpf } })) > 0;
}

/** Cria o usuário já ativo e com troca de senha obrigatória (defaults do schema). */
export async function criar(dados: NovoUsuario, cliente: ClienteDb = db): Promise<void> {
  await cliente.usuario.create({ data: dados });
}

/** Conta de e-mail e senha do Better Auth (`providerId = "credential"`). Guarda só o hash. */
export async function criarContaDeSenha(
  dados: { id: string; usuarioId: string; hash: string },
  cliente: ClienteDb = db,
): Promise<void> {
  await cliente.account.create({
    data: {
      id: dados.id,
      userId: dados.usuarioId,
      accountId: dados.usuarioId,
      providerId: "credential",
      password: dados.hash,
    },
  });
}

export async function trocarHashDaSenha(usuarioId: string, hash: string, cliente: ClienteDb = db): Promise<void> {
  await cliente.account.updateMany({
    where: { userId: usuarioId, providerId: "credential" },
    data: { password: hash },
  });
}

export async function definirDeveTrocarSenha(
  usuarioId: string,
  deveTrocarSenha: boolean,
  cliente: ClienteDb = db,
): Promise<void> {
  await cliente.usuario.update({ where: { id: usuarioId }, data: { deveTrocarSenha } });
}

export async function atualizarPerfil(
  id: string,
  dados: { papel: Papel; utId: string | null; telefone: string | null },
  cliente: ClienteDb = db,
): Promise<void> {
  await cliente.usuario.update({ where: { id }, data: dados });
}

export async function definirAtivo(id: string, ativo: boolean, cliente: ClienteDb = db): Promise<void> {
  await cliente.usuario.update({ where: { id }, data: { ativo } });
}

/** Encerra todas as sessões do usuário: ele cai na próxima requisição. */
export async function revogarSessoes(usuarioId: string, cliente: ClienteDb = db): Promise<void> {
  await cliente.session.deleteMany({ where: { userId: usuarioId } });
}
