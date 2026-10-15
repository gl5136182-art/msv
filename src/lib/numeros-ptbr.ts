// Entrada de números digitados em pt-BR (máscara de R$ e decimais com vírgula).
// Funções puras, usadas pelos formulários (cliente) e pelo schema do servidor.

const NBSP = " ";

/**
 * Máscara de R$ enquanto o usuário digita: só os dígitos contam e os dois últimos são os centavos.
 * `"12345"` → `"R$ 123,45"`. Sem dígitos devolve `""`.
 */
export function mascararMoeda(texto: string): string {
  const digitos = texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (digitos === "") return "";
  const centavos = digitos.padStart(3, "0");
  const inteiro = centavos.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$${NBSP}${inteiro},${centavos.slice(-2)}`;
}

/** Valor de um número como aparece no campo mascarado: `1234.5` → `"R$ 1.234,50"`. */
export function moedaParaCampo(valor: number): string {
  return mascararMoeda(String(Math.round(valor * 100)));
}

/**
 * Lê um decimal digitado em pt-BR. Aceita `12,5`, `1.234,5` e `12.5` (teclado em inglês).
 * Devolve `NaN` se não for um número.
 */
export function lerDecimalPtBr(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, "");
  if (limpo === "" || !/^\d[\d.,]*$/.test(limpo)) return Number.NaN;

  let normalizado: string;
  if (limpo.includes(",")) {
    // Vírgula é o separador decimal; pontos são milhar.
    if (limpo.split(",").length > 2) return Number.NaN;
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = limpo.split(".");
    const ultimo = partes[partes.length - 1];
    // "12.5" ou "0.75": um ponto com 1–2 casas depois é decimal. "1.234" ou "1.234.567" é milhar.
    const decimal = partes.length === 2 && ultimo.length <= 2;
    normalizado = decimal ? limpo : limpo.replace(/\./g, "");
  }

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : Number.NaN;
}

/** Lê o valor do campo mascarado de R$: `"R$ 1.234,56"` → `1234.56`. `NaN` se vazio. */
export function lerMoeda(texto: string): number {
  const digitos = texto.replace(/\D/g, "");
  if (digitos === "") return Number.NaN;
  return Number(digitos) / 100;
}

/** Número para exibir num campo decimal: `12.5` → `"12,5"`. */
export function decimalParaCampo(valor: number | null): string {
  if (valor === null) return "";
  return String(valor).replace(".", ",");
}
