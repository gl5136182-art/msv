import { obterUsuarioLogado } from "@/infra/sessao";

import { itensDoPapel } from "./itens-navegacao";
import { NavegacaoInferior } from "./navegacao-inferior";
import { TrilhoLateral } from "./trilho-lateral";

// Leem o papel da sessão (dado de requisição): o layout os envolve em <Suspense> (cacheComponents).
export async function TrilhoLateralServidor() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null;
  return <TrilhoLateral itens={itensDoPapel(usuario.papel)} />;
}

export async function NavegacaoInferiorServidor() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null;
  return <NavegacaoInferior itens={itensDoPapel(usuario.papel)} />;
}
