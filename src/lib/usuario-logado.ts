// Usuário logado, no formato que as actions passam aos services (CLAUDE.md, Arquitetura).
// Tipos e funções puras, sem Prisma nem Next: pode ser importado por qualquer camada.
// Não carrega o CPF de propósito (LGPD): quem precisa dele busca no banco.

// `moderador` é temporário, só para as apresentações: soma admin, almoxarife e colaborador
// (ver `temPapel`). Para remover, apague o papel daqui, do enum no schema e os usos de `temPapel`.
export const PAPEIS = ["colaborador", "almoxarife", "admin", "moderador"] as const;

export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  colaborador: "Colaborador",
  almoxarife: "Almoxarife",
  admin: "Administrador",
  moderador: "Moderador",
};

export type UsuarioLogado = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  /** UT principal. `null` só para admin sem UT. */
  utId: string | null;
  /** Outras UTs a que o usuário tem acesso, além da principal (ver `utsDoUsuario`). */
  utsAdicionais: string[];
  ativo: boolean;
  deveTrocarSenha: boolean;
};

/** O usuário tem um dos papéis? O moderador tem todos. */
export function temPapel(papel: Papel, ...papeis: Papel[]): boolean {
  return papel === "moderador" || papeis.includes(papel);
}

/** Todas as UTs do usuário: a principal primeiro, depois as adicionais, sem repetir. */
export function utsDoUsuario(usuario: { utId: string | null; utsAdicionais: string[] }): string[] {
  const uts = usuario.utId ? [usuario.utId] : [];
  for (const utId of usuario.utsAdicionais) if (!uts.includes(utId)) uts.push(utId);
  return uts;
}

/** O usuário está vinculado à UT (como principal ou adicional)? */
export function vinculadoAUt(usuario: { utId: string | null; utsAdicionais: string[] }, utId: string): boolean {
  return usuario.utId === utId || usuario.utsAdicionais.includes(utId);
}

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
 * Converte o usuário que vem da sessão do Better Auth em `UsuarioLogado`. As UTs adicionais
 * não vêm na sessão: quem chama busca no banco e passa em `utsAdicionais`.
 * Devolve `null` se o papel for desconhecido (dado corrompido: melhor negar do que adivinhar).
 * `ativo` e `deveTrocarSenha` ausentes viram o valor mais restritivo.
 */
export function montarUsuarioLogado(
  usuario: UsuarioDaSessao,
  utsAdicionais: string[] = [],
): UsuarioLogado | null {
  if (!ehPapel(usuario.papel)) return null;

  return {
    id: usuario.id,
    nome: usuario.name,
    email: usuario.email,
    papel: usuario.papel,
    utId: usuario.utId ?? null,
    utsAdicionais,
    ativo: usuario.ativo === true,
    deveTrocarSenha: usuario.deveTrocarSenha !== false,
  };
}
