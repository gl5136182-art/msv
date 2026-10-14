import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("@/infra/db", () => ({ db: {} }));
vi.mock("./dashboard.repository", () => ({
  listarItensDisponiveis: vi.fn(),
  listarItensCadastradosDesde: vi.fn(),
  listarTransferenciasConcluidas: vi.fn(),
  listarUtsParaFiltro: vi.fn(),
}));

import * as repository from "./dashboard.repository";
import type { TransferenciaBase, UtBase } from "./dashboard.regras";
import { filtrosDashboardSchema } from "./dashboard.schemas";
import { obterDashboard, resolverUtDoFiltro } from "./dashboard.service";

const repo = vi.mocked(repository);

const agora = new Date("2026-10-14T15:00:00Z");

const colaborador: UsuarioLogado = {
  id: "col",
  nome: "Colaborador",
  email: "col@manserv.com.br",
  papel: "colaborador",
  utId: "ut-a",
  ativo: true,
  deveTrocarSenha: false,
};
const almoxarife: UsuarioLogado = { ...colaborador, id: "alm", papel: "almoxarife" };
const admin: UsuarioLogado = { ...colaborador, id: "adm", papel: "admin", utId: null };

const utA: UtBase = { id: "ut-a", nome: "UT A", cidade: "Uberaba", uf: "MG" };
const utB: UtBase = { id: "ut-b", nome: "UT B", cidade: "Cubatão", uf: "SP" };

const padrao = filtrosDashboardSchema.parse({});

function transferencia(parcial: Partial<TransferenciaBase> = {}): TransferenciaBase {
  return {
    origem: utA,
    destino: utB,
    quantidade: 2,
    valorUnitarioSnapshot: 500,
    custoFrete: 100,
    concluidaEm: new Date("2026-09-10T15:00:00Z"),
    itemCriadoEm: new Date("2026-09-01T15:00:00Z"),
    ...parcial,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  repo.listarItensDisponiveis.mockResolvedValue([]);
  repo.listarItensCadastradosDesde.mockResolvedValue([]);
  repo.listarTransferenciasConcluidas.mockResolvedValue([]);
  repo.listarUtsParaFiltro.mockResolvedValue([utA, utB]);
});

describe("filtros por papel (SPEC §6.5)", () => {
  it("colaborador e almoxarife abrem na própria UT", () => {
    expect(resolverUtDoFiltro(colaborador, undefined)).toBe("ut-a");
    expect(resolverUtDoFiltro(almoxarife, undefined)).toBe("ut-a");
  });

  it("admin abre em Todas", () => {
    expect(resolverUtDoFiltro(admin, undefined)).toBeNull();
  });

  it('"todas" tira o filtro para qualquer papel e um id escolhe a UT', () => {
    expect(resolverUtDoFiltro(colaborador, "todas")).toBeNull();
    expect(resolverUtDoFiltro(admin, "ut-b")).toBe("ut-b");
    expect(resolverUtDoFiltro(colaborador, "ut-b")).toBe("ut-b");
  });

  it("repassa UT, categoria e o período de 12 meses ao repository", async () => {
    await obterDashboard(colaborador, { ...padrao, categoria: "ativo" }, agora);

    expect(repo.listarItensDisponiveis).toHaveBeenCalledWith({ utId: "ut-a", categoria: "ativo" });
    const [inicio, fim, filtro] = repo.listarTransferenciasConcluidas.mock.calls[0];
    expect(inicio.toISOString()).toBe("2025-11-01T03:00:00.000Z");
    expect(fim).toBe(agora);
    expect(filtro).toEqual({ utId: "ut-a", categoria: "ativo" });
  });
});

describe("autorização", () => {
  it("usuário inativo não vê o dashboard", async () => {
    await expect(obterDashboard({ ...colaborador, ativo: false }, padrao, agora)).rejects.toMatchObject({
      codigo: "USUARIO_INATIVO",
    });
    expect(repo.listarItensDisponiveis).not.toHaveBeenCalled();
  });
});

describe("indicadores", () => {
  it("monta KPIs, gráficos e a base do simulador", async () => {
    repo.listarItensDisponiveis.mockResolvedValue([
      { ut: utA, categoria: "ativo", quantidadeDisponivel: 3, valorUnitarioReposicao: 1000 },
      { ut: utB, categoria: "material", quantidadeDisponivel: 10, valorUnitarioReposicao: 20 },
    ]);
    repo.listarItensCadastradosDesde.mockResolvedValue([
      // Dentro dos 90 dias e do período.
      { criadoEm: new Date("2026-09-01T15:00:00Z"), quantidadeTotal: 8, valorUnitarioReposicao: 500 },
      // Fora dos 90 dias, dentro do período de 12 meses.
      { criadoEm: new Date("2026-03-01T15:00:00Z"), quantidadeTotal: 12, valorUnitarioReposicao: 100 },
    ]);
    repo.listarTransferenciasConcluidas.mockResolvedValue([
      transferencia({ quantidade: 2, valorUnitarioSnapshot: 500, custoFrete: 100 }),
      transferencia({
        quantidade: 1,
        valorUnitarioSnapshot: 300,
        custoFrete: 50,
        concluidaEm: new Date("2026-10-01T15:00:00Z"),
      }),
    ]);

    const d = await obterDashboard(admin, padrao, agora);

    expect(d.filtros).toEqual({ periodo: "12m", utId: null, categoria: null });
    expect(d.kpis.itensNaVitrine).toEqual({ itens: 2, unidades: 13 });
    expect(d.kpis.valorParado).toBe(3200);
    expect(d.kpis.economia).toEqual({ bruta: 1300, frete: 150, liquida: 1150 });
    expect(d.kpis.transferencias).toBe(2);
    expect(d.kpis.unidadesCedidas).toBe(3);
    expect(d.kpis.unidadesCadastradas).toBe(20);
    expect(d.kpis.taxaReaproveitamento).toBe(0.15);

    expect(d.graficos.economiaPorMes).toHaveLength(12);
    expect(d.graficos.economiaPorMes.at(-1)?.acumulada).toBe(1150);
    expect(d.graficos.valorParadoPorCategoria.map((b) => b.id)).toEqual(["ativo", "material"]);

    expect(d.simulador).toEqual({
      valorParado: 3200,
      itensDisponiveis: 2,
      valorCadastrado90d: 4000,
      itensCadastrados90d: 1,
      freteMedioPadrao: 75,
      freteDoHistorico: true,
    });
    expect(d.geradoEm).toBe(agora.toISOString());
  });

  it("sem histórico: tempo e taxa nulos e frete padrão de R$ 150", async () => {
    const d = await obterDashboard(admin, padrao, agora);
    expect(d.kpis.tempoMedioDias).toBeNull();
    expect(d.kpis.taxaReaproveitamento).toBeNull();
    expect(d.simulador.freteMedioPadrao).toBe(150);
    expect(d.simulador.freteDoHistorico).toBe(false);
  });

  it("com filtro de UT, a taxa conta só o que a UT cedeu (não o que recebeu)", async () => {
    repo.listarItensCadastradosDesde.mockResolvedValue([
      { criadoEm: new Date("2026-08-01T15:00:00Z"), quantidadeTotal: 10, valorUnitarioReposicao: 100 },
    ]);
    repo.listarTransferenciasConcluidas.mockResolvedValue([
      transferencia({ origem: utA, destino: utB, quantidade: 2 }),
      // A UT A recebeu 5 de outra UT: entra em economia e transferências, não na taxa.
      transferencia({ origem: utB, destino: utA, quantidade: 5 }),
    ]);

    const d = await obterDashboard(colaborador, padrao, agora);

    expect(d.kpis.transferencias).toBe(2);
    expect(d.kpis.unidadesCedidas).toBe(2);
    expect(d.kpis.taxaReaproveitamento).toBe(0.2);
  });

  it("cadastros anteriores ao período não entram na taxa e a busca cobre período e 90 dias", async () => {
    repo.listarItensCadastradosDesde.mockResolvedValue([
      { criadoEm: new Date("2026-07-20T15:00:00Z"), quantidadeTotal: 7, valorUnitarioReposicao: 100 },
      { criadoEm: new Date("2026-09-01T15:00:00Z"), quantidadeTotal: 10, valorUnitarioReposicao: 100 },
    ]);
    const d = await obterDashboard(admin, { ...padrao, periodo: "3m" }, agora);

    // 3 meses começam em 01/08: o item de julho fica fora da taxa (mas está dentro dos 90 dias).
    expect(d.kpis.unidadesCadastradas).toBe(10);
    expect(d.simulador.itensCadastrados90d).toBe(2);

    // Busca desde o mais antigo entre o início do período (01/08) e 90 dias atrás (16/07).
    const [desde] = repo.listarItensCadastradosDesde.mock.calls[0];
    expect(desde.toISOString()).toBe("2026-07-16T15:00:00.000Z");
  });
});
