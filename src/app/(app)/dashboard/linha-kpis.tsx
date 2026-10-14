import { formatarMoeda, formatarMoedaResumida, formatarNumero } from "@/lib/formatacao";
import type { KpisDto } from "@/modules/dashboard/dashboard.schemas";

// Linha de KPIs (DESIGN §7, item 4): cards brancos com o número em Arial laranja e o rótulo em
// Plex 12px abaixo. Valores em R$ usam a forma resumida; o valor exato vai na linha de detalhe.

type Kpi = { rotulo: string; valor: string; unidade?: string; detalhe?: string };

function montarKpis(kpis: KpisDto): Kpi[] {
  const { economia } = kpis;

  return [
    {
      rotulo: "Itens na vitrine",
      valor: formatarNumero(kpis.itensNaVitrine.itens),
      detalhe: `${formatarNumero(kpis.itensNaVitrine.unidades)} unidades`,
    },
    {
      rotulo: "Valor parado",
      valor: formatarMoedaResumida(kpis.valorParado),
      detalhe: `${formatarMoeda(kpis.valorParado)} em reposição`,
    },
    {
      rotulo: "Economia realizada",
      valor: formatarMoedaResumida(economia.liquida),
      detalhe: `Custo de compra evitado. Bruto ${formatarMoeda(economia.bruta)}, frete ${formatarMoeda(economia.frete)}`,
    },
    {
      rotulo: "Transferências concluídas",
      valor: formatarNumero(kpis.transferencias),
      detalhe: "no período",
    },
    {
      rotulo: "Tempo médio até a transferência",
      valor: kpis.tempoMedioDias === null ? "—" : formatarNumero(kpis.tempoMedioDias, 0, 1),
      unidade: kpis.tempoMedioDias === null ? undefined : kpis.tempoMedioDias === 1 ? "dia" : "dias",
      detalhe: "do cadastro à conclusão",
    },
    {
      rotulo: "Taxa de reaproveitamento",
      valor: kpis.taxaReaproveitamento === null ? "—" : `${formatarNumero(kpis.taxaReaproveitamento * 100, 0, 1)}%`,
      detalhe: `${formatarNumero(kpis.unidadesCedidas)} de ${formatarNumero(kpis.unidadesCadastradas)} unidades cadastradas`,
    },
  ];
}

export function LinhaKpis({ kpis }: { kpis: KpisDto }) {
  return (
    <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {montarKpis(kpis).map((kpi) => (
        <li key={kpi.rotulo} className="flex flex-col gap-1 rounded-md bg-card p-3">
          <p className="font-numeros text-[28px] leading-tight text-primary lg:text-[36px]">
            {kpi.valor}
            {kpi.unidade ? <span className="ml-1.5 text-sm text-foreground">{kpi.unidade}</span> : null}
          </p>
          <p className="text-xs font-medium">{kpi.rotulo}</p>
          {kpi.detalhe ? <p className="text-xs font-light text-muted-foreground">{kpi.detalhe}</p> : null}
        </li>
      ))}
    </ul>
  );
}
