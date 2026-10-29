import { rotuloUt } from "@/lib/rotulo-ut";

import type { BarraDto, Periodo } from "./dashboard.schemas";

// Fórmulas do dashboard (SPEC §6.5). Funções puras, sem banco nem framework: o service monta os
// registros e estas funções calculam. O simulador também roda no cliente (slider).
// Dinheiro é somado em centavos inteiros para não acumular erro de ponto flutuante.

/** Frete médio inicial do simulador (SPEC §6.5). */
export const FRETE_MEDIO_PADRAO = 150;

/** Quantas UTs entram nos gráficos "top 10". */
export const TOP_UTS = 10;

export type UtBase = { id: string; nome: string; cidade: string; uf: string };

export type ItemDisponivelBase = {
  ut: UtBase;
  categoria: "ativo" | "material";
  quantidadeDisponivel: number;
  valorUnitarioReposicao: number;
};

export type ItemCadastradoBase = {
  criadoEm: Date;
  quantidadeTotal: number;
  valorUnitarioReposicao: number;
};

const centavos = (valor: number): number => Math.round(valor * 100);
const reais = (cent: number): number => cent / 100;

// ---------------------------------------------------------------------------------------
// Período (fuso America/Sao_Paulo, UTC-3 fixo desde que o horário de verão acabou em 2019)
// ---------------------------------------------------------------------------------------

const FUSO = "America/Sao_Paulo";
const DESLOCAMENTO_HORAS = 3;

const formatoAnoMes = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit" });

function anoMesEmSaoPaulo(data: Date): { ano: number; mes: number } {
  const partes = Object.fromEntries(formatoAnoMes.formatToParts(data).map((p) => [p.type, p.value]));
  return { ano: Number(partes.year), mes: Number(partes.month) };
}

/** Meia-noite (São Paulo) do dia 1 do mês; `mes` de 1 a 12, aceita estouro (0 = dezembro anterior). */
function inicioDoMes(ano: number, mes: number): Date {
  return new Date(Date.UTC(ano, mes - 1, 1, DESLOCAMENTO_HORAS));
}

/** Janela do período: do dia 1 do primeiro mês (meses cheios) até `agora`. */
export function intervaloDoPeriodo(periodo: Periodo, agora: Date): { inicio: Date; fim: Date } {
  const { ano, mes } = anoMesEmSaoPaulo(agora);
  const mesesAtras = { "3m": 2, "6m": 5, "12m": 11, ano: mes - 1 }[periodo];
  return { inicio: inicioDoMes(ano, mes - mesesAtras), fim: agora };
}

// ---------------------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------------------

/** Itens na vitrine e valor parado, a partir dos itens `disponivel` de UTs ativas. */
export function resumirEstoque(itens: ItemDisponivelBase[]) {
  let unidades = 0;
  let valorCent = 0;
  for (const item of itens) {
    unidades += item.quantidadeDisponivel;
    valorCent += item.quantidadeDisponivel * centavos(item.valorUnitarioReposicao);
  }
  return { itens: itens.length, unidades, valorParado: reais(valorCent) };
}

export function somarUnidadesCadastradas(itens: ItemCadastradoBase[]): number {
  return itens.reduce((soma, item) => soma + item.quantidadeTotal, 0);
}

/** Valor cadastrado: Σ quantidade total × valor de reposição (base da projeção anual). */
export function somarValorCadastrado(itens: ItemCadastradoBase[]): number {
  return reais(itens.reduce((soma, item) => soma + item.quantidadeTotal * centavos(item.valorUnitarioReposicao), 0));
}

// ---------------------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------------------

function ordenarPorValor(barras: BarraDto[]): BarraDto[] {
  return barras.sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** Valor parado por UT, as 10 maiores (barras horizontais). */
export function valorParadoPorUt(itens: ItemDisponivelBase[], limite = TOP_UTS): BarraDto[] {
  const porUt = new Map<string, { rotulo: string; cent: number }>();
  for (const item of itens) {
    const atual = porUt.get(item.ut.id) ?? { rotulo: rotuloUt(item.ut), cent: 0 };
    atual.cent += item.quantidadeDisponivel * centavos(item.valorUnitarioReposicao);
    porUt.set(item.ut.id, atual);
  }
  const barras = [...porUt].map(([id, { rotulo, cent }]) => ({ id, rotulo, valor: reais(cent) }));
  return ordenarPorValor(barras).slice(0, limite);
}

const ROTULO_CATEGORIA_BARRA = { ativo: "Ativo", material: "Material" } as const;

/** Valor parado por categoria: sempre as duas barras que têm valor. */
export function valorParadoPorCategoria(itens: ItemDisponivelBase[]): BarraDto[] {
  const porCategoria = new Map<"ativo" | "material", number>();
  for (const item of itens) {
    const soma = porCategoria.get(item.categoria) ?? 0;
    porCategoria.set(item.categoria, soma + item.quantidadeDisponivel * centavos(item.valorUnitarioReposicao));
  }
  return ordenarPorValor(
    [...porCategoria].map(([id, cent]) => ({ id, rotulo: ROTULO_CATEGORIA_BARRA[id], valor: reais(cent) })),
  );
}

// ---------------------------------------------------------------------------------------
// Simulador (SPEC §6.5): projeção, não valor realizado
// ---------------------------------------------------------------------------------------

export type EntradaSimulacao = {
  valorParado: number;
  itensDisponiveis: number;
  valorCadastrado90d: number;
  itensCadastrados90d: number;
  /** 0 a 100. */
  percentual: number;
  /** R$ por transferência. */
  freteMedio: number;
};

/** Janela em dias da base do "valor cadastrado" do simulador. */
export const DIAS_BASE_SIMULADOR = 90;

/**
 * - Imediata = valor parado × % − (itens disponíveis × % × frete médio).
 * - Anual = (valor cadastrado nos últimos 90 dias × 4) × % − frete proporcional, ou seja,
 *   (itens cadastrados nos últimos 90 dias × 4) × % × frete médio.
 * "× 4" é a anualização do SPEC (90 dias ≈ 1/4 do ano).
 */
export function simular(entrada: EntradaSimulacao): { imediata: number; anual: number } {
  const fracao = Math.min(Math.max(entrada.percentual, 0), 100) / 100;
  const frete = Math.max(entrada.freteMedio, 0);
  const anualizar = 4;

  const imediata = entrada.valorParado * fracao - entrada.itensDisponiveis * fracao * frete;
  const anual =
    entrada.valorCadastrado90d * anualizar * fracao - entrada.itensCadastrados90d * anualizar * fracao * frete;

  return { imediata: Math.round(imediata * 100) / 100, anual: Math.round(anual * 100) / 100 };
}
