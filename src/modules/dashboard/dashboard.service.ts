import { exigirPapel } from "@/lib/permissoes";
import { rotuloUt } from "@/lib/rotulo-ut";
import { temPapel, type UsuarioLogado } from "@/lib/usuario-logado";

import {
  intervaloDoPeriodo,
  resumirEstoque,
  resumirTransferencias,
  valorParadoPorCategoria,
  valorParadoPorUt,
} from "./dashboard.regras";
import * as repository from "./dashboard.repository";
import { TODAS_AS_UTS, type DashboardDto, type FiltrosDashboard } from "./dashboard.schemas";

// Dashboard (SPEC §6.5). Qualquer usuário ativo vê; os padrões de filtro dependem do papel.

/**
 * UT efetiva do filtro: `"todas"` = sem filtro; ausente = padrão do papel (colaborador e almoxarife
 * abrem na própria UT, admin abre em "Todas"); um id = aquela UT.
 */
export function resolverUtDoFiltro(usuario: UsuarioLogado, utId: string | undefined): string | null {
  if (utId === TODAS_AS_UTS) return null;
  if (utId) return utId;
  return temPapel(usuario.papel, "admin") ? null : usuario.utId;
}

export async function obterDashboard(
  usuario: UsuarioLogado,
  filtros: FiltrosDashboard,
  agora: Date = new Date(),
): Promise<DashboardDto> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");

  const utId = resolverUtDoFiltro(usuario, filtros.utId);
  const categoria = filtros.categoria ?? null;
  const filtro = { utId, categoria };

  const { inicio, fim } = intervaloDoPeriodo(filtros.periodo, agora);
  const [disponiveis, uts, transferencias] = await Promise.all([
    repository.listarItensDisponiveis(filtro),
    repository.listarUtsParaFiltro(utId),
    repository.listarTransferenciasNoPeriodo(inicio, fim, filtro),
  ]);
  const transferido = resumirTransferencias(transferencias);

  const estoque = resumirEstoque(disponiveis);

  return {
    filtros: { periodo: filtros.periodo, utId, categoria },
    intervalo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    uts: uts.map((ut) => ({ id: ut.id, rotulo: rotuloUt(ut) })),
    kpis: {
      itensNaVitrine: { itens: estoque.itens, unidades: estoque.unidades },
      valorParado: estoque.valorParado,
      valorTransferido: transferido.valor,
      itensTransferidos: { unidades: transferido.unidades, itens: transferido.itens },
    },
    graficos: {
      valorParadoPorUt: valorParadoPorUt(disponiveis),
      valorParadoPorCategoria: valorParadoPorCategoria(disponiveis),
    },
    geradoEm: agora.toISOString(),
  };
}
