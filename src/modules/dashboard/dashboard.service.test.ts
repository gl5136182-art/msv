import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("@/infra/db", () => ({ db: {} }));
vi.mock("./dashboard.repository", () => ({
  listarItensDisponiveis: vi.fn(),
  listarUtsParaFiltro: vi.fn(),
  listarTransferenciasNoPeriodo: vi.fn(),
}));

import * as repository from "./dashboard.repository";
import type { UtBase } from "./dashboard.regras";
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
  utsAdicionais: [],
  ativo: true,
  deveTrocarSenha: false,
};
const almoxarife: UsuarioLogado = { ...colaborador, id: "alm", papel: "almoxarife" };
const admin: UsuarioLogado = { ...colaborador, id: "adm", papel: "admin", utId: null };

const utA: UtBase = { id: "ut-a", nome: "UT A", cidade: "Uberaba", uf: "MG" };
const utB: UtBase = { id: "ut-b", nome: "UT B", cidade: "Cubatão", uf: "SP" };

const padrao = filtrosDashboardSchema.parse({});

beforeEach(() => {
  vi.resetAllMocks();
  repo.listarItensDisponiveis.mockResolvedValue([]);
  repo.listarUtsParaFiltro.mockResolvedValue([utA, utB]);
  repo.listarTransferenciasNoPeriodo.mockResolvedValue([]);
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

  it("repassa UT e categoria ao repository", async () => {
    await obterDashboard(colaborador, { ...padrao, categoria: "ativo" }, agora);

    expect(repo.listarItensDisponiveis).toHaveBeenCalledWith({ utId: "ut-a", categoria: "ativo" });
    expect(repo.listarTransferenciasNoPeriodo).toHaveBeenCalledWith(expect.any(Date), agora, {
      utId: "ut-a",
      categoria: "ativo",
    });
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
  it("monta KPIs e gráficos", async () => {
    repo.listarItensDisponiveis.mockResolvedValue([
      { ut: utA, categoria: "ativo", quantidadeDisponivel: 3, valorUnitarioReposicao: 1000 },
      { ut: utB, categoria: "material", quantidadeDisponivel: 10, valorUnitarioReposicao: 20 },
    ]);
    repo.listarTransferenciasNoPeriodo.mockResolvedValue([
      { itemId: "i1", quantidade: 2, valorUnitarioReposicao: 100.5 },
      { itemId: "i1", quantidade: 1, valorUnitarioReposicao: 100.5 },
      { itemId: "i2", quantidade: 4, valorUnitarioReposicao: 10 },
    ]);

    const d = await obterDashboard(admin, padrao, agora);

    expect(d.filtros).toEqual({ periodo: "12m", utId: null, categoria: null });
    expect(d.kpis.itensNaVitrine).toEqual({ itens: 2, unidades: 13 });
    expect(d.kpis.valorParado).toBe(3200);
    expect(d.kpis.valorTransferido).toBe(341.5);
    expect(d.kpis.itensTransferidos).toEqual({ unidades: 7, itens: 2 });

    expect(d.graficos.valorParadoPorUt.map((b) => b.id)).toEqual(["ut-a", "ut-b"]);
    expect(d.graficos.valorParadoPorCategoria.map((b) => b.id)).toEqual(["ativo", "material"]);

    expect(d.geradoEm).toBe(agora.toISOString());
  });

  it("busca as transferências desde o início do período até agora", async () => {
    await obterDashboard(admin, { ...padrao, periodo: "3m" }, agora);

    const [inicio, fim] = repo.listarTransferenciasNoPeriodo.mock.calls[0];
    expect(inicio.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(fim).toBe(agora);
  });
});
