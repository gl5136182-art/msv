// Formatação de valores para a interface, sempre em pt-BR (CLAUDE.md, Convenções; DESIGN §3).
// Funções puras. Datas são gravadas em UTC e exibidas em America/Sao_Paulo.
//
// O espaço entre "R$" e o número é o não separável (U+00A0), como no Intl, para a quebra de
// linha não separar o símbolo do valor.

const LOCALE = "pt-BR";
const FUSO = "America/Sao_Paulo";
const NBSP = " ";

const formatoMoeda = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" });

// Data e hora montadas por partes: o Intl em pt-BR insere vírgula entre data e hora.
const formatoDataHora = new Intl.DateTimeFormat(LOCALE, {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `1234.5` → `R$ 1.234,50`. */
export function formatarMoeda(valor: number): string {
  return formatoMoeda.format(valor);
}

/**
 * Para KPIs e eixos: `1_234_567` → `R$ 1,2 mi`, `2_500_000_000` → `R$ 2,5 bi`.
 * Abaixo de 1 milhão usa o valor completo (`R$ 12.300,00`).
 */
export function formatarMoedaCompacta(valor: number): string {
  const faixas = [
    { limite: 1e9, sufixo: "bi" },
    { limite: 1e6, sufixo: "mi" },
  ];
  const faixa = faixas.find((f) => Math.abs(valor) >= f.limite);
  if (!faixa) return formatarMoeda(valor);

  const sinal = valor < 0 ? "-" : "";
  const escalado = formatarNumero(Math.abs(valor) / faixa.limite, 0, 1);
  return `${sinal}R$${NBSP}${escalado}${NBSP}${faixa.sufixo}`;
}

/** `1547` → `1.547`; `1234.5` com casas 2 → `1.234,50`. */
export function formatarNumero(valor: number, casasMin = 0, casasMax = casasMin): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: casasMin,
    maximumFractionDigits: Math.max(casasMin, casasMax),
  }).format(valor);
}

/** `1547, "un"` → `1.547 un`. */
export function formatarQuantidade(quantidade: number, unidade: string): string {
  return `${formatarNumero(quantidade)}${NBSP}${unidade}`;
}

/** `dd/mm/aaaa hh:mm` no fuso America/Sao_Paulo. Aceita `Date` ou string ISO (DTOs). */
export function formatarDataHora(data: Date | string): string {
  const p = partes(data);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** `dd/mm/aaaa` no fuso America/Sao_Paulo. Aceita `Date` ou string ISO (DTOs). */
export function formatarData(data: Date | string): string {
  const p = partes(data);
  return `${p.day}/${p.month}/${p.year}`;
}

function partes(data: Date | string): Record<string, string> {
  const instante = typeof data === "string" ? new Date(data) : data;
  // `format` lança RangeError para data inválida: erro de programação, não de usuário.
  return Object.fromEntries(
    formatoDataHora.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
}
