// Usuário logado, no formato que as actions passam aos services (CLAUDE.md, Arquitetura).
// Tipos e funções puras, sem Prisma nem Next: pode ser importado por qualquer camada.
// Não carrega o CPF de propósito (LGPD): quem precisa dele busca no banco.

export const PAPEIS = ["colaborador", "almoxarife", "admin"] as const;

export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  colaborador: "Colaborador",
  almoxarife: "Almoxarife",
  admin: "Administrador",
};

export type UsuarioLogado = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** `null` só para admin sem UT. */
  utId: string | null;
  ativo: boolean;
  deveTrocarSenha: boolean;
};

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && (PAPEIS as readonly string[]).includes(valor);
}

type UsuarioDaSessao = {
  id: string;
  name: string;
  email: string;
  papel?: unknown;
  utId?: string | null;
  ativo?: boolean | null;
  deveTrocarSenha?: boolean | null;
};

/**
 * Converte o usuário que vem da sessão do Better Auth em `UsuarioLogado`.
 * Devolve `null` se o papel for desconhecido (dado corrompido: melhor negar do que adivinhar).
 * `ativo` e `deveTrocarSenha` ausentes viram o valor mais restritivo.
 */
export function montarUsuarioLogado(usuario: UsuarioDaSessao): UsuarioLogado | null {
  if (!ehPapel(usuario.papel)) return null;

  return {
    id: usuario.id,
    nome: usuario.name,
    email: usuario.email,
    papel: usuario.papel,
    utId: usuario.utId ?? null,
    ativo: usuario.ativo === true,
    deveTrocarSenha: usuario.deveTrocarSenha !== false,
  };
}
