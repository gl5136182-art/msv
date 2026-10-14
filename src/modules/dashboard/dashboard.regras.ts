import { rotuloUt } from "@/lib/rotulo-ut";

import type {
  BarraDto,
  CedeuRecebeuDto,
  KpisDto,
  Periodo,
  PontoMensalDto,
} from "./dashboard.schemas";

// Fórmulas do dashboard (SPEC §6.5). Funções puras, sem banco nem framework: o service monta os
// registros e estas funções calculam. O simulador também roda no cliente (slider).
// Dinheiro é somado em centavos inteiros para não acumular erro de ponto flutuante.

/** Frete médio usado no simulador quando ainda não há transferência concluída (SPEC §6.5). */
export const FRETE_MEDIO_SEM_HISTORICO = 150;

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

/** Solicitação `concluida`: origem é a UT do item e destino é a UT de quem pediu. */
export type TransferenciaBase = {
  origem: UtBase;
  destino: UtBase;
  quantidade: number;
  valorUnitarioSnapshot: number;
  custoFrete: number;
  concluidaEm: Date;
  itemCriadoEm: Date;
};

const centavos = (valor: number): number => Math.round(valor * 100);
const reais = (cent: number): number => cent / 100;

// ---------------------------------------------------------------------------------------
// Período e meses (fuso America/Sao_Paulo, UTC-3 fixo desde que o horário de verão acabou em 2019)
// ---------------------------------------------------------------------------------------

const FUSO = "America/Sao_Paulo";
const DESLOCAMENTO_HORAS = 3;
const MESES_ABREVIADOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const formatoAnoMes = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit" });

function anoMesEmSaoPaulo(data: Date): { ano: number; mes: number } {
  const partes = Object.fromEntries(formatoAnoMes.formatToParts(data).map((p) => [p.type, p.value]));
  return { ano: Number(partes.year), mes: Number(partes.month) };
}

/** Meia-noite (São Paulo) do dia 1 do mês; `mes` de 1 a 12, aceita estouro (0 = dezembro anterior). */
function inicioDoMes(ano: number, mes: number): Date {
  return new Date(Date.UTC(ano, mes - 1, 1, DESLOCAMENTO_HORAS));
}

/** `aaaa-mm` do instante, no fuso de São Paulo. */
export function chaveDoMes(data: Date): string {
  const { ano, mes } = anoMesEmSaoPaulo(data);
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** `2026-01` → `jan/26`. */
export function rotuloDoMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MESES_ABREVIADOS[Number(mes) - 1]}/${ano.slice(2)}`;
}

/** Janela do período: do dia 1 do primeiro mês (meses cheios) até `agora`. */
export function intervaloDoPeriodo(periodo: Periodo, agora: Date): { inicio: Date; fim: Date } {
  const { ano, mes } = anoMesEmSaoPaulo(agora);
  const mesesAtras = { "3m": 2, "6m": 5, "12m": 11, ano: mes - 1 }[periodo];
  return { inicio: inicioDoMes(ano, mes - mesesAtras), fim: agora };
}

/** Chaves `aaaa-mm` de todos os meses entre `inicio` e `fim`, na ordem. */
export function mesesDoIntervalo(inicio: Date, fim: Date): string[] {
  const primeiro = anoMesEmSaoPaulo(inicio);
  const ultimo = anoMesEmSaoPaulo(fim);
  const total = (ultimo.ano - primeiro.ano) * 12 + (ultimo.mes - primeiro.mes);

  return Array.from({ length: total + 1 }, (_, i) => {
    const indice = primeiro.mes - 1 + i;
    const ano = primeiro.ano + Math.floor(indice / 12);
    return `${ano}-${String((indice % 12) + 1).padStart(2, "0")}`;
  });
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

/** Economia = Σ(quantidade × snapshot) − Σ frete (SPEC §6.5): líquido, bruto e frete. */
export function calcularEconomia(transferencias: TransferenciaBase[]): KpisDto["economia"] {
  let brutaCent = 0;
  let freteCent = 0;
  for (const t of transferencias) {
    brutaCent += t.quantidade * centavos(t.valorUnitarioSnapshot);
    freteCent += centavos(t.custoFrete);
  }
  return { liquida: reais(brutaCent - freteCent), bruta: reais(brutaCent), frete: reais(freteCent) };
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Média de (conclusão − cadastro do item) em dias; `null` sem transferências. */
export function calcularTempoMedioDias(transferencias: TransferenciaBase[]): number | null {
  if (transferencias.length === 0) return null;
  const totalMs = transferencias.reduce(
    (soma, t) => soma + (t.concluidaEm.getTime() - t.itemCriadoEm.getTime()),
    0,
  );
  return totalMs / transferencias.length / MS_POR_DIA;
}

/** Unidades transferidas ÷ unidades cadastradas; `null` se nada foi cadastrado. */
export function calcularTaxaReaproveitamento(unidadesCedidas: number, unidadesCadastradas: number): number | null {
  return unidadesCadastradas > 0 ? unidadesCedidas / unidadesCadastradas : null;
}

export function somarUnidades(transferencias: TransferenciaBase[]): number {
  return transferencias.reduce((soma, t) => soma + t.quantidade, 0);
}

export function somarUnidadesCadastradas(itens: ItemCadastradoBase[]): number {
  return itens.reduce((soma, item) => soma + item.quantidadeTotal, 0);
}

/** Valor cadastrado: Σ quantidade total × valor de reposição (base da projeção anual). */
export function somarValorCadastrado(itens: ItemCadastradoBase[]): number {
  return reais(itens.reduce((soma, item) => soma + item.quantidadeTotal * centavos(item.valorUnitarioReposicao), 0));
}

/** Frete médio por transferência; sem histórico, o padrão do SPEC (R$ 150). */
export function calcularFreteMedio(transferencias: TransferenciaBase[]): { valor: number; doHistorico: boolean } {
  if (transferencias.length === 0) return { valor: FRETE_MEDIO_SEM_HISTORICO, doHistorico: false };
  const totalCent = transferencias.reduce((soma, t) => soma + centavos(t.custoFrete), 0);
  return { valor: Math.round(totalCent / transferencias.length) / 100, doHistorico: true };
}

// ---------------------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------------------

/** Economia líquida por mês (todos os meses do período, mesmo zerados) e o acumulado. */
export function economiaPorMes(transferencias: TransferenciaBase[], meses: string[]): PontoMensalDto[] {
  const porMes = new Map<string, number>(meses.map((mes) => [mes, 0]));
  for (const t of transferencias) {
    const mes = chaveDoMes(t.concluidaEm);
    if (!porMes.has(mes)) continue;
    porMes.set(mes, porMes.get(mes)! + t.quantidade * centavos(t.valorUnitarioSnapshot) - centavos(t.custoFrete));
  }

  let acumuladoCent = 0;
  return meses.map((mes) => {
    const liquidaCent = porMes.get(mes)!;
    acumuladoCent += liquidaCent;
    return { mes, rotulo: rotuloDoMes(mes), liquida: reais(liquidaCent), acumulada: reais(acumuladoCent) };
  });
}

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

/**
 * UTs que mais cederam × mais receberam, em R$ (bruto: quantidade × snapshot). As 10 UTs com
 * maior movimento (cedeu + recebeu). Com filtro de UT aparecem a UT e as contrapartes.
 */
export function cedeuRecebeu(transferencias: TransferenciaBase[], limite = TOP_UTS): CedeuRecebeuDto[] {
  const porUt = new Map<string, { rotulo: string; cedeuCent: number; recebeuCent: number }>();
  const obter = (ut: UtBase) => {
    const atual = porUt.get(ut.id) ?? { rotulo: rotuloUt(ut), cedeuCent: 0, recebeuCent: 0 };
    porUt.set(ut.id, atual);
    return atual;
  };

  for (const t of transferencias) {
    const valorCent = t.quantidade * centavos(t.valorUnitarioSnapshot);
    obter(t.origem).cedeuCent += valorCent;
    obter(t.destino).recebeuCent += valorCent;
  }

  return [...porUt]
    .map(([id, u]) => ({ id, rotulo: u.rotulo, cedeu: reais(u.cedeuCent), recebeu: reais(u.recebeuCent) }))
    .sort((a, b) => b.cedeu + b.recebeu - (a.cedeu + a.recebeu) || a.rotulo.localeCompare(b.rotulo, "pt-BR"))
    .slice(0, limite);
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
