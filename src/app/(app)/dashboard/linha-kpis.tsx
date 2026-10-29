import { formatarMoeda, formatarMoedaResumida, formatarNumero } from "@/lib/formatacao";
import type { KpisDto } from "@/modules/dashboard/dashboard.schemas";

// Faixa única de resumo (DESIGN §7, item 4): número em Arial laranja e rótulo em Plex 12px.
// Valores em R$ usam a forma resumida; o valor exato vai na linha de detalhe.

type Kpi = { rotulo: string; valor: string; unidade?: string; detalhe?: string };

function montarKpis(kpis: KpisDto): Kpi[] {
  return [
    {
      rotulo: "Itens na vitrine",
      valor: formatarNumero(kpis.itensNaVitrine.itens),
      detalhe: `${formatarNumero(kpis.itensNaVitrine.unidades)} unidades`,
    },
    {
      rotulo: "Valor ocioso",
      valor: formatarMoedaResumida(kpis.valorParado),
      detalhe: `${formatarMoeda(kpis.valorParado)} em reposição`,
    },
  ];
}

export function LinhaKpis({ kpis }: { kpis: KpisDto }) {
  return (
    <ul aria-label="Resumo do estoque" className="grid grid-cols-2 rounded-md bg-card text-foreground">
      {montarKpis(kpis).map((kpi) => (
        <li
          key={kpi.rotulo}
          className="flex flex-col gap-1 border-l border-border p-3 first:border-l-0 lg:flex-row lg:items-center lg:gap-4 lg:px-4"
        >
          <p className="shrink-0 font-numeros text-[28px] leading-tight text-primary lg:text-[36px]">
            {kpi.valor}
            {kpi.unidade ? <span className="ml-1.5 text-sm text-foreground">{kpi.unidade}</span> : null}
          </p>
          <div>
            <p className="text-xs font-medium">{kpi.rotulo}</p>
            {kpi.detalhe ? <p className="text-xs font-light text-muted-foreground">{kpi.detalhe}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
