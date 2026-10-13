import { ErroNegocio } from "@/lib/erro-negocio";
import type { Papel, UsuarioLogado } from "@/lib/usuario-logado";

// Autorização por papel dentro dos services (SPEC §7): nenhuma permissão fica só na interface.
// Quem chama o service passa o `UsuarioLogado`; o service confere aqui.

/** Exige usuário ativo com um dos papéis. Lança `ErroNegocio` caso contrário. */
export function exigirPapel(usuario: UsuarioLogado, ...papeis: Papel[]): void {
  if (!usuario.ativo) {
    throw new ErroNegocio("USUARIO_INATIVO", "Seu usuário está inativo. Fale com o administrador.");
  }
  if (!papeis.includes(usuario.papel)) {
    throw new ErroNegocio("SEM_PERMISSAO", "Você não tem permissão para realizar esta ação.");
  }
}
