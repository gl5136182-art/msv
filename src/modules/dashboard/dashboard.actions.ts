"use server";

import { exigirUsuarioLogado } from "@/infra/sessao";
import { executar, type Resultado } from "@/lib/erro-negocio";

import { filtrosDashboardSchema, type DashboardDto } from "./dashboard.schemas";
import * as service from "./dashboard.service";

/** `entrada` são os parâmetros da URL; o schema ignora o que for inválido (não gera erro). */
export async function obterDashboard(entrada: unknown): Promise<Resultado<DashboardDto>> {
  const filtros = filtrosDashboardSchema.parse(entrada ?? {});
  return executar(async () => service.obterDashboard(await exigirUsuarioLogado(), filtros));
}
