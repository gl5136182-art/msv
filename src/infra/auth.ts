import { betterAuth } from "better-auth";
import { isAPIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { parseSetCookieHeader, toCookieOptions } from "better-auth/cookies";
import { generateRandomString, hashPassword } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import { cookies } from "next/headers";

import { db } from "@/infra/db";

// Better Auth: e-mail e senha, sem autocadastro (SPEC §4). Única integração de login do app.
//
// - Usuários são criados só pelo admin, pelo server-side (módulo `usuarios`). O endpoint
//   público de sign-up fica desabilitado.
// - A tabela de usuário é `Usuario` (modelName "usuario"), com os campos adicionais do SPEC §5.
// - O rate limit do Better Auth só vale para requisições que passam pelo `auth.handler`
//   (HTTP). Chamadas diretas a `auth.api.*` no servidor não passam por ele. Por isso o login
//   do app deve entrar pelo handler, ver a tarefa "Tela de login".
// - O storage do rate limit é o banco (tabela `rate_limit`): em serverless o storage em
//   memória não é compartilhado entre instâncias e não limitaria nada.
//
// Criado sob demanda, como o Prisma em db.ts: importar este módulo não exige segredo
// (ex.: `next build` sem .env). `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` vêm do ambiente.

const SETE_DIAS_EM_SEGUNDOS = 60 * 60 * 24 * 7;
const UM_DIA_EM_SEGUNDOS = 60 * 60 * 24;

function criarAuth() {
  return betterAuth({
    database: prismaAdapter(db, { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },

    // Sessão de 7 dias (SPEC §4). Sem cookie cache: desativar o usuário ou redefinir a senha
    // revoga as sessões, e isso precisa valer na hora, não depois do cache expirar.
    session: {
      expiresIn: SETE_DIAS_EM_SEGUNDOS,
      updateAge: UM_DIA_EM_SEGUNDOS,
    },

    user: {
      modelName: "usuario",
      additionalFields: {
        cpf: { type: "string", required: true, unique: true, input: false },
        papel: { type: "string", required: true, input: false },
        utId: { type: "string", required: false, input: false },
        telefone: { type: "string", required: false, input: false },
        ativo: { type: "boolean", required: true, defaultValue: true, input: false },
        deveTrocarSenha: { type: "boolean", required: true, defaultValue: true, input: false },
      },
    },

    rateLimit: {
      storage: "database",
      customRules: {
        // Tentativas de login: 10 por minuto por IP (vários colaboradores podem compartilhar
        // o mesmo IP de saída na rede da Manserv, por isso o limite não é menor).
        "/sign-in/email": { window: 60, max: 10 },
      },
    },

    databaseHooks: {
      session: {
        create: {
          // Última barreira (SPEC §4): usuário inativo nunca recebe sessão, por qualquer caminho.
          before: async (sessao) => {
            const usuario = await db.usuario.findUnique({
              where: { id: sessao.userId },
              select: { ativo: true },
            });
            if (!usuario?.ativo) return false;
          },
        },
      },
    },

    // Permite que `auth.api.*` chamado de uma server action grave o cookie de sessão
    // (ex.: trocar a senha). Deve ser o último plugin.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof criarAuth>;

const globalParaAuth = globalThis as unknown as { auth?: Auth };

/** Instância única do Better Auth (reaproveitada no hot reload em desenvolvimento). */
export function obterAuth(): Auth {
  return (globalParaAuth.auth ??= criarAuth());
}

export type ResultadoEntrada = "ok" | "invalido" | "limite";

// Cabeçalhos repassados ao handler: o IP (rate limit) e o user agent (registro da sessão).
const CABECALHOS_REPASSADOS = ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "user-agent"];

/**
 * Autentica por e-mail e senha pelo `auth.handler`, para que o rate limit do Better Auth
 * valha (ele não vale em chamadas diretas a `auth.api.*`). Em caso de sucesso grava o cookie
 * de sessão. Só para server actions e route handlers.
 *
 * - `invalido`: e-mail ou senha errados, usuário inexistente ou inativo (não distingue).
 * - `limite`: tentativas demais; o Better Auth bloqueia o IP por um tempo.
 */
export async function entrarComEmailESenha(entrada: {
  email: string;
  senha: string;
  cabecalhos: Headers;
}): Promise<ResultadoEntrada> {
  const cabecalhos = new Headers({ "content-type": "application/json" });
  for (const nome of CABECALHOS_REPASSADOS) {
    const valor = entrada.cabecalhos.get(nome);
    if (valor) cabecalhos.set(nome, valor);
  }

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const resposta = await obterAuth().handler(
    new Request(new URL("/api/auth/sign-in/email", base), {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ email: entrada.email, password: entrada.senha }),
    }),
  );

  if (resposta.status === 429) return "limite";
  if (!resposta.ok) return "invalido";

  // O handler devolve o Set-Cookie na resposta HTTP; numa server action ele precisa ser
  // repassado ao cookie store do Next.
  const setCookie = resposta.headers.get("set-cookie");
  if (setCookie) {
    const jar = await cookies();
    parseSetCookieHeader(setCookie).forEach((valor, nome) => {
      if (nome) jar.set(nome, valor.value, toCookieOptions(valor));
    });
  }
  return "ok";
}

export type ResultadoTrocaDeSenha = "ok" | "senha_atual_invalida";

/**
 * Troca a senha do usuário da sessão atual (lida dos cookies da requisição) e encerra as
 * outras sessões dele. O cookie da sessão nova é gravado pelo plugin `nextCookies`.
 * Só para server actions.
 */
export async function trocarSenhaDaSessao(entrada: {
  senhaAtual: string;
  novaSenha: string;
  cabecalhos: Headers;
}): Promise<ResultadoTrocaDeSenha> {
  try {
    await obterAuth().api.changePassword({
      headers: entrada.cabecalhos,
      body: {
        currentPassword: entrada.senhaAtual,
        newPassword: entrada.novaSenha,
        revokeOtherSessions: true,
      },
    });
    return "ok";
  } catch (erro) {
    if (isAPIError(erro) && erro.body?.code === "INVALID_PASSWORD") return "senha_atual_invalida";
    throw erro;
  }
}

/** Encerra a sessão da requisição e apaga o cookie. Sem sessão, não faz nada. */
export async function encerrarSessaoDaRequisicao(cabecalhos: Headers): Promise<void> {
  try {
    await obterAuth().api.signOut({ headers: cabecalhos });
  } catch (erro) {
    if (isAPIError(erro)) return;
    throw erro;
  }
}

// Criação de usuários pelo admin (SPEC §4, §6.0). O módulo `usuarios` grava as linhas de
// `usuario` e `account` pelo Prisma, dentro de uma transação, e usa estas duas funções para
// que o formato do hash e dos ids seja o que o Better Auth espera ao fazer login.

/** Hash da senha no formato do Better Auth (scrypt). Só o hash é armazenado. */
export async function gerarHashDeSenha(senha: string): Promise<string> {
  return hashPassword(senha);
}

/** Id no formato que o Better Auth gera para usuário, conta e sessão. */
export function gerarIdDeAuth(): string {
  return generateRandomString(32, "a-z", "A-Z", "0-9");
}
