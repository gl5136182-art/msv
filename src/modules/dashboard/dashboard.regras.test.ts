import { describe, expect, it } from "vitest";

import {
  intervaloDoPeriodo,
  resumirEstoque,
  simular,
  valorParadoPorCategoria,
  valorParadoPorUt,
  type ItemDisponivelBase,
  type UtBase,
} from "./dashboard.regras";

const utA: UtBase = { id: "a", nome: "UT A", cidade: "Uberaba", uf: "MG" };
const utB: UtBase = { id: "b", nome: "UT B", cidade: "Cubatão", uf: "SP" };

function disponivel(parcial: Partial<ItemDisponivelBase>): ItemDisponivelBase {
  return { ut: utA, categoria: "material", quantidadeDisponivel: 1, valorUnitarioReposicao: 100, ...parcial };
}

describe("período", () => {
  const agora = new Date("2026-10-14T15:00:00Z");

  it("12 meses cheios: do dia 1 de novembro do ano anterior até agora", () => {
    const { inicio, fim } = intervaloDoPeriodo("12m", agora);
    // Meia-noite de São Paulo (UTC-3).
    expect(inicio.toISOString()).toBe("2025-11-01T03:00:00.000Z");
    expect(fim).toBe(agora);
  });

  it("3 e 6 meses incluem o mês corrente", () => {
    expect(intervaloDoPeriodo("3m", agora).inicio.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(intervaloDoPeriodo("6m", agora).inicio.toISOString()).toBe("2026-05-01T03:00:00.000Z");
  });

  it("ano atual começa em 1º de janeiro", () => {
    expect(intervaloDoPeriodo("ano", agora).inicio.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });
});

describe("KPIs", () => {
  it("estoque: conta itens, soma unidades e valor ocioso", () => {
    const resumo = resumirEstoque([
      disponivel({ quantidadeDisponivel: 3, valorUnitarioReposicao: 1000.5 }),
      disponivel({ quantidadeDisponivel: 10, valorUnitarioReposicao: 25.1 }),
    ]);
    expect(resumo).toEqual({ itens: 2, unidades: 13, valorParado: 3252.5 });
  });
});

describe("gráficos", () => {
  it("valor ocioso por UT: soma por UT, ordena do maior para o menor e limita a 10", () => {
    const itens = [
      disponivel({ ut: utA, quantidadeDisponivel: 2, valorUnitarioReposicao: 100 }),
      disponivel({ ut: utA, quantidadeDisponivel: 1, valorUnitarioReposicao: 50 }),
      disponivel({ ut: utB, quantidadeDisponivel: 1, valorUnitarioReposicao: 1000 }),
    ];
    const barras = valorParadoPorUt(itens);
    expect(barras.map((b) => [b.id, b.valor])).toEqual([
      ["b", 1000],
      ["a", 250],
    ]);
    expect(barras[0].rotulo).toBe("UT B · Cubatão/SP");

    const muitas = Array.from({ length: 12 }, (_, i) =>
      disponivel({ ut: { ...utA, id: `ut${i}`, nome: `UT ${i}` }, valorUnitarioReposicao: 100 + i }),
    );
    expect(valorParadoPorUt(muitas)).toHaveLength(10);
  });

  it("valor ocioso por categoria", () => {
    const barras = valorParadoPorCategoria([
      disponivel({ categoria: "ativo", quantidadeDisponivel: 2, valorUnitarioReposicao: 300 }),
      disponivel({ categoria: "material", quantidadeDisponivel: 1, valorUnitarioReposicao: 100 }),
      disponivel({ categoria: "material", quantidadeDisponivel: 5, valorUnitarioReposicao: 10 }),
    ]);
    expect(barras).toEqual([
      { id: "ativo", rotulo: "Ativo", valor: 600 },
      { id: "material", rotulo: "Material", valor: 150 },
    ]);
  });
});

describe("simulador", () => {
  const base = {
    valorParado: 100_000,
    itensDisponiveis: 40,
    valorCadastrado90d: 20_000,
    itensCadastrados90d: 10,
    freteMedio: 150,
  };

  it("projeção imediata = valor ocioso × % − itens × % × frete", () => {
    // 100000 × 0,3 − 40 × 0,3 × 150 = 30000 − 1800
    expect(simular({ ...base, percentual: 30 }).imediata).toBe(28_200);
  });

  it("projeção anual = valor cadastrado em 90 dias × 4 × % − frete proporcional", () => {
    // 20000 × 4 × 0,3 − 10 × 4 × 0,3 × 150 = 24000 − 1800
    expect(simular({ ...base, percentual: 30 }).anual).toBe(22_200);
  });

  it("0% não projeta nada e 100% reaproveita tudo", () => {
    expect(simular({ ...base, percentual: 0 })).toEqual({ imediata: 0, anual: 0 });
    expect(simular({ ...base, percentual: 100 }).imediata).toBe(100_000 - 40 * 150);
  });

  it("o frete pode inverter a projeção (não esconde o prejuízo)", () => {
    const projecao = simular({ ...base, valorParado: 1000, itensDisponiveis: 10, percentual: 100, freteMedio: 500 });
    expect(projecao.imediata).toBe(-4000);
  });

  it("ignora percentual fora de 0–100 e frete negativo", () => {
    expect(simular({ ...base, percentual: 150 })).toEqual(simular({ ...base, percentual: 100 }));
    expect(simular({ ...base, percentual: 50, freteMedio: -10 })).toEqual(
      simular({ ...base, percentual: 50, freteMedio: 0 }),
    );
  });
});
