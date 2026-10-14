import { LogoManserv } from "@/components/marca";
import { formatarData, formatarDataHora } from "@/lib/formatacao";
import type { DashboardDto } from "@/modules/dashboard/dashboard.schemas";

import { FiltrosDashboard } from "./filtros-dashboard";
import {
  GraficoCedeuRecebeu,
  GraficoEconomiaPorMes,
  GraficoValorParadoPorCategoria,
  GraficoValorParadoPorUt,
} from "./graficos";
import { LinhaKpis } from "./linha-kpis";
import { Simulador } from "./simulador";

// Painel "Estoque e economia" (SPEC §6.5, DESIGN §7): cabeçalho e filtros escuros, KPIs,
// 4 gráficos, simulador e rodapé, sobre fundo cinza com 8px entre os cards.
export function PainelDashboard({ dados: d }: { dados: DashboardDto }) {
  const chaveFiltros = `${d.filtros.periodo}|${d.filtros.utId ?? "todas"}|${d.filtros.categoria ?? ""}`;

  return (
    // No mobile o painel ocupa a largura toda (anula o padding da página).
    <div className="-mx-4 -mt-4 bg-cinza lg:mx-0 lg:mt-0 lg:overflow-hidden lg:rounded-md">
      <header className="flex items-start justify-between gap-4 bg-grafite px-4 pt-4 pb-3 text-white">
        <div>
          <h1 className="text-xl font-bold">Estoque e economia</h1>
          <p className="mt-1 text-xs font-bold">
            Período: {formatarData(d.intervalo.inicio)} a {formatarData(d.intervalo.fim)}
          </p>
        </div>
        <LogoManserv altura={20} className="mt-0.5 shrink-0 text-white" aria-hidden />
      </header>

      <FiltrosDashboard
        key={chaveFiltros}
        periodo={d.filtros.periodo}
        utId={d.filtros.utId}
        categoria={d.filtros.categoria}
        uts={d.uts}
      />

      <div className="flex flex-col gap-2 p-4">
        <LinhaKpis kpis={d.kpis} />

        <div className="grid gap-2 lg:grid-cols-2">
          <GraficoEconomiaPorMes pontos={d.graficos.economiaPorMes} />
          <GraficoValorParadoPorUt barras={d.graficos.valorParadoPorUt} />
          <GraficoCedeuRecebeu linhas={d.graficos.cedeuRecebeu} />
          <GraficoValorParadoPorCategoria barras={d.graficos.valorParadoPorCategoria} />
          <Simulador key={chaveFiltros} base={d.simulador} />
        </div>

        <footer className="flex flex-wrap justify-between gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
          <p>Fonte: MSV | Atualizado em {formatarDataHora(d.geradoEm)}</p>
          <p>Apenas circulação interna</p>
        </footer>
      </div>
    </div>
  );
}
