import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { obterAuth } from "@/infra/auth";
import { decidirAcesso } from "@/lib/acesso";
import { montarUsuarioLogado } from "@/lib/usuario-logado";

// Proxy (middleware no Next 16, roda em Node): aplica a regra de acesso do SPEC §4.
//   sem sessão → /login · `deve_trocar_senha` → /trocar-senha · usuário inativo → /login.
// A autorização por papel e UT NÃO fica aqui: é do service (SPEC §7).

export async function proxy(request: NextRequest) {
  const usuario = await buscarUsuarioDaRequisicao(request);
  const decisao = decidirAcesso({ caminho: request.nextUrl.pathname, usuario });

  if (decisao.acao === "redirecionar") {
    const destino = request.nextUrl.clone();
    destino.pathname = decisao.para;
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return NextResponse.next();
}

async function buscarUsuarioDaRequisicao(request: NextRequest): Promise<{ deveTrocarSenha: boolean } | null> {
  // Prefetch dos links do Next: só confere se existe cookie de sessão, sem ir ao banco. A
  // navegação de verdade passa pela checagem completa (e as actions conferem de novo).
  const ehPrefetch =
    request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (ehPrefetch) {
    return getSessionCookie(request) ? { deveTrocarSenha: false } : null;
  }

  // Sem cookie, nem consulta o banco.
  if (!getSessionCookie(request)) return null;

  // `disableRefresh`: o proxy não grava cookie. A sessão renova nas server actions.
  const sessao = await obterAuth().api.getSession({
    headers: request.headers,
    query: { disableRefresh: true },
  });
  if (!sessao) return null;

  const usuario = montarUsuarioLogado(sessao.user);
  if (!usuario?.ativo) return null;
  return { deveTrocarSenha: usuario.deveTrocarSenha };
}

export const config = {
  // Fora do proxy: assets do Next, ícones e marca, manifest e service worker do PWA
  // (o navegador os busca sem sessão para instalar o app).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|brand/).*)",
  ],
};
