import { headers } from "next/headers";
import { cache } from "react";

import { obterAuth } from "@/infra/auth";
import { db } from "@/infra/db";
import { ErroNegocio } from "@/lib/erro-negocio";
import { montarUsuarioLogado, type UsuarioLogado } from "@/lib/usuario-logado";

// Usuário logado para actions e Server Components (SPEC §4, §7).
// Lê a sessão no banco a cada chamada (sem cookie cache), então `ativo` e `deve_trocar_senha`
// refletem o estado atual. As actions passam o resultado ao service como parâmetro.

/**
 * Usuário da sessão atual, ou `null` se não há sessão válida. Não checa `ativo`.
 * Lê dados da requisição: com `cacheComponents`, quem chama fica atrás de um `<Suspense>`.
 * O `cache` do React evita repetir a consulta (menu, página etc.) dentro da mesma requisição.
 */
export const obterUsuarioLogado = cache(async (): Promise<UsuarioLogado | null> => {
  const sessao = await obterAuth().api.getSession({ headers: await headers() });
  if (!sessao) return null;
  const adicionais = await db.usuarioUtAdicional.findMany({
    where: { usuarioId: sessao.user.id },
    select: { utId: true },
    orderBy: { criadoEm: "asc" },
  });
  return montarUsuarioLogado(
    sessao.user,
    adicionais.map((a) => a.utId),
  );
});

type OpcoesExigir = {
  /** Só a action de trocar a senha usa: ela precisa rodar enquanto a troca está pendente. */
  permitirTrocaPendente?: boolean;
};

/**
 * Para as actions: exige sessão válida, usuário ativo e senha já trocada.
 * Lança `ErroNegocio`, que a action devolve como `{ ok: false, erro }`.
 */
export async function exigirUsuarioLogado(opcoes: OpcoesExigir = {}): Promise<UsuarioLogado> {
  const usuario = await obterUsuarioLogado();

  if (!usuario) {
    throw new ErroNegocio("NAO_AUTENTICADO", "Sua sessão expirou. Entre novamente.");
  }
  if (!usuario.ativo) {
    throw new ErroNegocio("USUARIO_INATIVO", "Seu usuário está inativo. Fale com o administrador.");
  }
  if (usuario.deveTrocarSenha && !opcoes.permitirTrocaPendente) {
    throw new ErroNegocio("TROCA_DE_SENHA_PENDENTE", "Troque a sua senha para continuar.");
  }
  return usuario;
}
