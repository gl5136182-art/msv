import { z } from "zod";

import { CATEGORIAS_ITEM, type CategoriaItem } from "@/modules/itens/itens.schemas";

// Dashboard (SPEC §6.5). Importado também por componentes de cliente: só depende do Zod e de tipos.

export const PERIODOS = ["3m", "6m", "12m", "ano"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const PERIODO_PADRAO: Periodo = "12m";

export const ROTULO_PERIODO: Record<Periodo, string> = {
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  "12m": "Últimos 12 meses",
  ano: "Ano atual",
};

/** Valor do filtro de UT que significa "sem filtro" (na URL e na entrada da action). */
export const TODAS_AS_UTS = "todas";

/**
 * Filtros do dashboard, lidos da URL. Tolerante: valor inválido volta ao padrão.
 * `utId` ausente = padrão do papel (própria UT; admin vê "Todas"); `"todas"` = sem filtro.
 */
export const filtrosDashboardSchema = z.object({
  periodo: z.enum(PERIODOS).catch(PERIODO_PADRAO),
  utId: z.string().trim().min(1).max(60).optional().catch(undefined),
  categoria: z.enum(CATEGORIAS_ITEM).optional().catch(undefined),
});
export type FiltrosDashboard = z.output<typeof filtrosDashboardSchema>;

export type UtFiltroDto = { id: string; rotulo: string };

export type KpisDto = {
  /** Itens `disponivel` de UTs ativas (o que a vitrine mostra) e a soma das unidades. */
  itensNaVitrine: { itens: number; unidades: number };
  /** Σ quantidade disponível × valor de reposição. */
  valorParado: number;
  /** Custo de compra evitado das concluídas no período: líquido = bruto − frete. */
  economia: { liquida: number; bruta: number; frete: number };
  transferencias: number;
  /** Dias entre o cadastro do item e a conclusão; `null` sem transferências. */
  tempoMedioDias: number | null;
  /** Unidades cedidas ÷ unidades cadastradas no período (0 a 1+); `null` sem cadastros. */
  taxaReaproveitamento: number | null;
  unidadesCedidas: number;
  unidadesCadastradas: number;
};

export type PontoMensalDto = {
  /** `aaaa-mm` no fuso de São Paulo. */
  mes: string;
  /** `jan/26`. */
  rotulo: string;
  liquida: number;
  acumulada: number;
};

export type BarraDto = { id: string; rotulo: string; valor: number };

export type CedeuRecebeuDto = { id: string; rotulo: string; cedeu: number; recebeu: number };

/** Base do simulador (SPEC §6.5); a conta é refeita no cliente a cada movimento do slider. */
export type SimuladorBaseDto = {
  valorParado: number;
  itensDisponiveis: number;
  valorCadastrado90d: number;
  itensCadastrados90d: number;
  /** Média real do frete das concluídas, ou R$ 150 sem histórico. */
  freteMedioPadrao: number;
  freteDoHistorico: boolean;
};

export type DashboardDto = {
  filtros: { periodo: Periodo; utId: string | null; categoria: CategoriaItem | null };
  intervalo: { inicio: string; fim: string };
  /** UTs ativas para o select (mais a selecionada, se estiver inativa). */
  uts: UtFiltroDto[];
  kpis: KpisDto;
  graficos: {
    economiaPorMes: PontoMensalDto[];
    valorParadoPorUt: BarraDto[];
    valorParadoPorCategoria: BarraDto[];
    cedeuRecebeu: CedeuRecebeuDto[];
  };
  simulador: SimuladorBaseDto;
  geradoEm: string;
};
