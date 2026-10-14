import {
  filtrosDashboardSchema,
  PERIODO_PADRAO,
  type FiltrosDashboard,
} from "@/modules/dashboard/dashboard.schemas";

// Parâmetros da URL do dashboard: `periodo`, `ut` (id ou "todas") e `categoria`. Funções puras.
// Sem `ut` vale o padrão do papel (própria UT; o admin vê "Todas"), resolvido no service.

type ParametrosUrl = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Lê os filtros da URL. Valor inválido ou vazio volta ao padrão (o schema é tolerante). */
export function filtrosDosParametros(parametros: ParametrosUrl): FiltrosDashboard {
  return filtrosDashboardSchema.parse({
    periodo: primeiro(parametros.periodo),
    utId: primeiro(parametros.ut) || undefined,
    categoria: primeiro(parametros.categoria) || undefined,
  });
}

/** Monta o link do dashboard com os filtros. Omite o período padrão. */
export function hrefDashboard(filtros: FiltrosDashboard): string {
  const parametros = new URLSearchParams();
  if (filtros.periodo !== PERIODO_PADRAO) parametros.set("periodo", filtros.periodo);
  if (filtros.utId) parametros.set("ut", filtros.utId);
  if (filtros.categoria) parametros.set("categoria", filtros.categoria);

  const texto = parametros.toString();
  return texto ? `/dashboard?${texto}` : "/dashboard";
}
