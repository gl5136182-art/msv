// Erros de negócio e o padrão de retorno das actions (CLAUDE.md, Arquitetura).
//
// O service lança `ErroNegocio` com mensagem em português, pronta para o usuário.
// A action converte em `{ ok: false, erro }` com `executar`, e a tela só exibe o texto.
// Funções puras: este arquivo não importa `next/*`, Prisma nem Zod.

export class ErroNegocio extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroNegocio";
    this.codigo = codigo;
  }
}

export type Resultado<T = void> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; codigo?: string };

const MENSAGEM_ERRO_INESPERADO = "Não foi possível concluir a ação. Tente novamente.";

export function sucesso(): Resultado<void>;
export function sucesso<T>(dados: T): Resultado<T>;
export function sucesso<T>(dados?: T): Resultado<T> {
  return { ok: true, dados: dados as T };
}

export function falha(erro: string, codigo?: string): Resultado<never> {
  return codigo === undefined ? { ok: false, erro } : { ok: false, erro, codigo };
}

/**
 * Converte o erro de validação do Zod (entrada da action) em `{ ok: false, erro }`, com a
 * mensagem do primeiro campo inválido. Estrutural: este arquivo não importa o Zod.
 */
export function falhaDeValidacao(erro: { issues: ReadonlyArray<{ message: string }> }): Resultado<never> {
  return falha(erro.issues[0]?.message ?? "Dados inválidos. Confira os campos e tente de novo.", "VALIDACAO");
}

/**
 * Executa o service dentro da action e converte `ErroNegocio` em `{ ok: false, erro }`.
 *
 * - Qualquer outro erro é registrado no servidor e vira uma mensagem genérica, sem expor
 *   detalhes técnicos ao usuário.
 * - Os erros de controle de fluxo do Next (`redirect()`, `notFound()`) são relançados: o
 *   Next os usa para navegar e eles não podem ser engolidos.
 */
export async function executar<T>(operacao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return sucesso(await operacao());
  } catch (erro) {
    if (erro instanceof ErroNegocio) return falha(erro.message, erro.codigo);
    if (ehControleDeFluxoDoNext(erro)) throw erro;

    console.error("Erro inesperado na action:", erro);
    return falha(MENSAGEM_ERRO_INESPERADO);
  }
}

function ehControleDeFluxoDoNext(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null || !("digest" in erro)) return false;
  const { digest } = erro as { digest: unknown };
  return typeof digest === "string" && digest.startsWith("NEXT_");
}
