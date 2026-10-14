import { describe, expect, it } from "vitest";

import {
  calcularEconomia,
  calcularFreteMedio,
  calcularTaxaReaproveitamento,
  calcularTempoMedioDias,
  cedeuRecebeu,
  chaveDoMes,
  economiaPorMes,
  intervaloDoPeriodo,
  mesesDoIntervalo,
  resumirEstoque,
  rotuloDoMes,
  simular,
  valorParadoPorCategoria,
  valorParadoPorUt,
  type ItemDisponivelBase,
  type TransferenciaBase,
  type UtBase,
} from "./dashboard.regras";

const utA: UtBase = { id: "a", nome: "UT A", cidade: "Uberaba", uf: "MG" };
const utB: UtBase = { id: "b", nome: "UT B", cidade: "Cubatão", uf: "SP" };
const utC: UtBase = { id: "c", nome: "UT C", cidade: "Recife", uf: "PE" };

function transferencia(parcial: Partial<TransferenciaBase>): TransferenciaBase {
  return {
    origem: utA,
    destino: utB,
    quantidade: 1,
    valorUnitarioSnapshot: 100,
    custoFrete: 0,
    concluidaEm: new Date("2026-06-15T15:00:00Z"),
    itemCriadoEm: new Date("2026-06-05T15:00:00Z"),
    ...parcial,
  };
}

function disponivel(parcial: Partial<ItemDisponivelBase>): ItemDisponivelBase {
  return { ut: utA, categoria: "material", quantidadeDisponivel: 1, valorUnitarioReposicao: 100, ...parcial };
}

describe("período e meses", () => {
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

  it("o mês é o de São Paulo, não o de UTC", () => {
    // 01/11 01:00 UTC ainda é 31/10 22:00 em São Paulo.
    expect(chaveDoMes(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
    expect(chaveDoMes(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11");
  });

  it("lista todos os meses do intervalo, atravessando o ano", () => {
    const { inicio, fim } = intervaloDoPeriodo("12m", agora);
    const meses = mesesDoIntervalo(inicio, fim);
    expect(meses).toHaveLength(12);
    expect(meses[0]).toBe("2025-11");
    expect(meses[2]).toBe("2026-01");
    expect(meses[11]).toBe("2026-10");
  });

  it("rotula o mês em pt-BR abreviado", () => {
    expect(rotuloDoMes("2026-01")).toBe("jan/26");
    expect(rotuloDoMes("2025-12")).toBe("dez/25");
  });
});

describe("KPIs", () => {
  it("estoque: conta itens, soma unidades e valor parado", () => {
    const resumo = resumirEstoque([
      disponivel({ quantidadeDisponivel: 3, valorUnitarioReposicao: 1000.5 }),
      disponivel({ quantidadeDisponivel: 10, valorUnitarioReposicao: 25.1 }),
    ]);
    expect(resumo).toEqual({ itens: 2, unidades: 13, valorParado: 3252.5 });
  });

  it("economia: líquido = bruto − frete, com os dois detalhes", () => {
    const economia = calcularEconomia([
      transferencia({ quantidade: 2, valorUnitarioSnapshot: 500, custoFrete: 120 }),
      transferencia({ quantidade: 1, valorUnitarioSnapshot: 80.1, custoFrete: 30.05 }),
    ]);
    expect(economia).toEqual({ bruta: 1080.1, frete: 150.05, liquida: 930.05 });
  });

  it("economia sem transferências é zero", () => {
    expect(calcularEconomia([])).toEqual({ bruta: 0, frete: 0, liquida: 0 });
  });

  it("não acumula erro de ponto flutuante (0,1 + 0,2)", () => {
    const economia = calcularEconomia([
      transferencia({ valorUnitarioSnapshot: 0.1 }),
      transferencia({ valorUnitarioSnapshot: 0.2 }),
    ]);
    expect(economia.bruta).toBe(0.3);
  });

  it("tempo médio em dias entre o cadastro do item e a conclusão", () => {
    const dias = calcularTempoMedioDias([
      transferencia({ itemCriadoEm: new Date("2026-06-01T12:00:00Z"), concluidaEm: new Date("2026-06-11T12:00:00Z") }),
      transferencia({ itemCriadoEm: new Date("2026-06-01T12:00:00Z"), concluidaEm: new Date("2026-06-21T12:00:00Z") }),
    ]);
    expect(dias).toBe(15);
    expect(calcularTempoMedioDias([])).toBeNull();
  });

  it("taxa de reaproveitamento: unidades transferidas ÷ cadastradas", () => {
    expect(calcularTaxaReaproveitamento(25, 100)).toBe(0.25);
    expect(calcularTaxaReaproveitamento(0, 100)).toBe(0);
    expect(calcularTaxaReaproveitamento(5, 0)).toBeNull();
  });

  it("frete médio: média real das concluídas ou R$ 150 sem histórico", () => {
    expect(calcularFreteMedio([])).toEqual({ valor: 150, doHistorico: false });
    expect(calcularFreteMedio([transferencia({ custoFrete: 100 }), transferencia({ custoFrete: 201 })])).toEqual({
      valor: 150.5,
      doHistorico: true,
    });
    // Histórico só com frete zero: a média real é zero, não o padrão.
    expect(calcularFreteMedio([transferencia({ custoFrete: 0 })])).toEqual({ valor: 0, doHistorico: true });
  });
});

describe("gráficos", () => {
  it("economia por mês: preenche meses sem transferência e acumula", () => {
    const meses = ["2026-04", "2026-05", "2026-06"];
    const pontos = economiaPorMes(
      [
        transferencia({
          concluidaEm: new Date("2026-04-10T15:00:00Z"),
          quantidade: 2,
          valorUnitarioSnapshot: 100,
          custoFrete: 20,
        }),
        transferencia({
          concluidaEm: new Date("2026-06-20T15:00:00Z"),
          quantidade: 1,
          valorUnitarioSnapshot: 500,
          custoFrete: 50,
        }),
        // Fora dos meses pedidos: ignorada.
        transferencia({ concluidaEm: new Date("2026-09-01T15:00:00Z"), valorUnitarioSnapshot: 999 }),
      ],
      meses,
    );
    expect(pontos.map((p) => [p.rotulo, p.liquida, p.acumulada])).toEqual([
      ["abr/26", 180, 180],
      ["mai/26", 0, 180],
      ["jun/26", 450, 630],
    ]);
  });

  it("valor parado por UT: soma por UT, ordena do maior para o menor e limita a 10", () => {
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

  it("valor parado por categoria", () => {
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

  it("cedeu × recebeu: R$ bruto por UT, ordenado pelo movimento total", () => {
    const linhas = cedeuRecebeu([
      transferencia({ origem: utA, destino: utB, quantidade: 2, valorUnitarioSnapshot: 100 }),
      transferencia({ origem: utA, destino: utC, quantidade: 1, valorUnitarioSnapshot: 300 }),
      transferencia({ origem: utB, destino: utA, quantidade: 1, valorUnitarioSnapshot: 50 }),
    ]);
    expect(linhas.map((l) => [l.id, l.cedeu, l.recebeu])).toEqual([
      ["a", 500, 50],
      ["c", 0, 300],
      ["b", 50, 200],
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

  it("projeção imediata = valor parado × % − itens × % × frete", () => {
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
