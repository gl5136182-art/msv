// Regra de acesso por rota para quem tem (ou não) sessão (SPEC §4). Função pura: o proxy
// (src/proxy.ts) busca o usuário e aplica a decisão.
//
// - sem sessão (ou usuário inativo) → /login;
// - logado em /login → volta para dentro do app;
// - `deve_trocar_senha` → só /trocar-senha, qualquer outra rota vai para lá.

export const ROTA_LOGIN = "/login";
export const ROTA_TROCAR_SENHA = "/trocar-senha";
export const ROTA_INICIAL = "/";

export type DecisaoDeAcesso = { acao: "liberar" } | { acao: "redirecionar"; para: string };

type EntradaDeAcesso = {
  caminho: string;
  /** `null` quando não há sessão válida ou o usuário está inativo. */
  usuario: { deveTrocarSenha: boolean } | null;
};

const LIBERAR: DecisaoDeAcesso = { acao: "liberar" };

function redirecionar(para: string): DecisaoDeAcesso {
  return { acao: "redirecionar", para };
}

export function decidirAcesso({ caminho, usuario }: EntradaDeAcesso): DecisaoDeAcesso {
  const rota = caminho.replace(/\/+$/, "") || "/";

  if (!usuario) {
    return rota === ROTA_LOGIN ? LIBERAR : redirecionar(ROTA_LOGIN);
  }

  if (rota === ROTA_LOGIN) {
    return redirecionar(usuario.deveTrocarSenha ? ROTA_TROCAR_SENHA : ROTA_INICIAL);
  }

  if (usuario.deveTrocarSenha && rota !== ROTA_TROCAR_SENHA) {
    return redirecionar(ROTA_TROCAR_SENHA);
  }

  return LIBERAR;
}
