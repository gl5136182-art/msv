// Normaliza texto para busca: minúsculas, sem acento e sem espaços repetidos (CLAUDE.md,
// "Busca"). Vale para a coluna `busca_normalizada` e para o termo digitado, que passam pela
// mesma função. Função pura.

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
