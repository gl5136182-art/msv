import type { Metadata } from "next";

import { obterDashboard } from "@/modules/dashboard/dashboard.actions";

import { PainelDashboard } from "./painel-dashboard";
import { filtrosDosParametros } from "./parametros";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaDashboard({ searchParams }: Props) {
  const resultado = await obterDashboard(filtrosDosParametros(await searchParams));

  if (!resultado.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {resultado.erro}
      </p>
    );
  }

  return <PainelDashboard dados={resultado.dados} />;
}
