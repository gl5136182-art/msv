import { describe, expect, it } from "vitest";

import { cpfValido } from "@/lib/cpf";
import {
  calcularEconomia,
  calcularTaxaReaproveitamento,
  economiaPorMes,
  intervaloDoPeriodo,
  mesesDoIntervalo,
  resumirEstoque,
  somarUnidades,
  valorParadoPorCategoria,
  type TransferenciaBase,
} from "@/modules/dashboard/dashboard.regras";

import { cpfComDigitos, gerarConjuntoDemo, PREFIXO_UT_DEMO } from "./demo-dados";

const agora = new Date("2026-10-14T15:00:00Z");
const conjunto = gerarConjuntoDemo(agora);

describe("conjunto de demonstração (SPEC §9, fase 6)", () => {
  it("é determinístico: a mesma data gera o mesmo conjunto", () => {
    expect(gerarConjuntoDemo(agora)).toEqual(conjunto);
  });

  it("tem 12 UTs DEMO- de estados diferentes, com cidade e UF", () => {
    expect(conjunto.uts).toHaveLength(12);
    expect(conjunto.uts.every((ut) => ut.codigo.startsWith(PREFIXO_UT_DEMO) && ut.codigo.length <= 20)).toBe(true);
    expect(conjunto.uts[0].nome).toBe("UT Demonstração 01");
    expect(conjunto.uts[11].nome).toBe("UT Demonstração 12");
    expect(new Set(conjunto.uts.map((ut) => ut.uf)).size).toBe(12);
    expect(conjunto.uts.every((ut) => ut.cidade.length > 0)).toBe(true);
  });

  it("gera CPFs válidos e únicos, e e-mails únicos", () => {
    expect(conjunto.usuarios).toHaveLength(24);
    expect(conjunto.usuarios.every((u) => cpfValido(u.cpf))).toBe(true);
    expect(new Set(conjunto.usuarios.map((u) => u.cpf)).size).toBe(24);
    expect(new Set(conjunto.usuarios.map((u) => u.email)).size).toBe(24);
  });

  it("cpfComDigitos calcula os dígitos verificadores", () => {
    expect(cpfComDigitos("123456789")).toBe("12345678909");
  });

  it("tem cerca de 150 itens com RM único e campos válidos", () => {
    expect(conjunto.itens).toHaveLength(150);
    expect(new Set(conjunto.itens.map((i) => i.rm)).size).toBe(150);
    for (const item of conjunto.itens) {
      expect(item.rm).toMatch(/^\d{1,20}$/);
      expect(item.quantidadeTotal).toBeGreaterThan(0);
      expect(item.quantidadeDisponivel).toBeGreaterThanOrEqual(0);
      expect(item.quantidadeDisponivel).toBeLessThanOrEqual(item.quantidadeTotal);
      expect(item.valorUnitarioReposicao).toBeGreaterThan(0);
      expect(item.larguraCm).toBeGreaterThan(0);
      expect(item.pesoKg).toBeGreaterThan(0);
      // Ativo exige depreciação; material não tem.
      expect(item.valorDepreciacaoMensal !== null).toBe(item.categoria === "ativo");
      expect(item.fotos.length).toBeGreaterThan(0);
    }
  });

  it("status do item é coerente com a quantidade", () => {
    for (const item of conjunto.itens) {
      if (item.quantidadeDisponivel === 0) expect(item.status).toBe("esgotado");
      else expect(["disponivel", "arquivado"]).toContain(item.status);
    }
    expect(conjunto.itens.some((i) => i.status === "disponivel")).toBe(true);
  });

  it("tem cerca de 60 solicitações concluídas, espalhadas em 12 meses", () => {
    expect(conjunto.solicitacoes).toHaveLength(60);

    const { inicio, fim } = intervaloDoPeriodo("12m", agora);
    const meses = mesesDoIntervalo(inicio, fim);
    const mensal = economiaPorMes(
      conjunto.solicitacoes.map((s) => paraTransferencia(s)),
      meses,
    );
    const mesesComTransferencia = mensal.filter((p) => p.liquida !== 0).length;
    expect(mesesComTransferencia).toBeGreaterThanOrEqual(8);
  });

  it("solicitações respeitam as regras: outra UT, ordem das datas e quantidade do item", () => {
    const itemPorId = new Map(conjunto.itens.map((i) => [i.id, i]));
    const transferidoPorItem = new Map<string, number>();

    for (const s of conjunto.solicitacoes) {
      const item = itemPorId.get(s.itemId)!;
      expect(s.utDestinoCodigo).not.toBe(item.utCodigo);
      expect(s.criadoEm.getTime()).toBeGreaterThan(item.criadoEm.getTime());
      expect(s.respondidaEm.getTime()).toBeGreaterThan(s.criadoEm.getTime());
      expect(s.concluidaEm.getTime()).toBeGreaterThan(s.respondidaEm.getTime());
      expect(s.concluidaEm.getTime()).toBeLessThan(agora.getTime());
      expect(s.valorUnitarioSnapshot).toBe(item.valorUnitarioReposicao);
      expect(s.custoFrete).toBeGreaterThanOrEqual(0);
      transferidoPorItem.set(s.itemId, (transferidoPorItem.get(s.itemId) ?? 0) + s.quantidade);
    }

    for (const [itemId, total] of transferidoPorItem) {
      const item = itemPorId.get(itemId)!;
      // O que saiu mais o que ficou fecha a quantidade cadastrada.
      expect(total + item.quantidadeDisponivel).toBe(item.quantidadeTotal);
    }
  });

  it("indicadores do dashboard batem com uma conta independente sobre os dados", () => {
    // Conta feita à mão, em centavos, direto sobre o conjunto.
    let brutoCent = 0;
    let freteCent = 0;
    let unidades = 0;
    for (const s of conjunto.solicitacoes) {
      brutoCent += s.quantidade * Math.round(s.valorUnitarioSnapshot * 100);
      freteCent += Math.round(s.custoFrete * 100);
      unidades += s.quantidade;
    }
    const transferencias = conjunto.solicitacoes.map((s) => paraTransferencia(s));
    const economia = calcularEconomia(transferencias);
    expect(economia.bruta).toBe(brutoCent / 100);
    expect(economia.frete).toBe(freteCent / 100);
    expect(economia.liquida).toBe((brutoCent - freteCent) / 100);
    expect(somarUnidades(transferencias)).toBe(unidades);

    // Valor parado: só itens disponíveis (a vitrine).
    const disponiveis = conjunto.itens.filter((i) => i.status === "disponivel");
    const valorParadoCent = disponiveis.reduce(
      (soma, i) => soma + i.quantidadeDisponivel * Math.round(i.valorUnitarioReposicao * 100),
      0,
    );
    const base = disponiveis.map((i) => ({
      ut: utBase(i.utCodigo),
      categoria: i.categoria,
      quantidadeDisponivel: i.quantidadeDisponivel,
      valorUnitarioReposicao: i.valorUnitarioReposicao,
    }));
    const estoque = resumirEstoque(base);
    expect(estoque.itens).toBe(disponiveis.length);
    expect(estoque.valorParado).toBe(valorParadoCent / 100);
    expect(valorParadoPorCategoria(base).reduce((soma, b) => soma + b.valor, 0)).toBeCloseTo(valorParadoCent / 100, 2);

    // Taxa: unidades cedidas ÷ unidades cadastradas (itens cadastrados há ≤ 12 meses não existem
    // antes de `inicio`? os mais antigos entram no denominador só se criados no período).
    const { inicio } = intervaloDoPeriodo("12m", agora);
    const cadastradas = conjunto.itens
      .filter((i) => i.criadoEm >= inicio)
      .reduce((soma, i) => soma + i.quantidadeTotal, 0);
    expect(calcularTaxaReaproveitamento(unidades, cadastradas)).toBe(unidades / cadastradas);
  });

  it("o resultado fica numa faixa convincente para a apresentação", () => {
    const transferencias = conjunto.solicitacoes.map((s) => paraTransferencia(s));
    const economia = calcularEconomia(transferencias);
    expect(economia.liquida).toBeGreaterThan(50_000);
    expect(economia.frete).toBeGreaterThan(0);
  });
});

function utBase(codigo: string) {
  const ut = conjunto.uts.find((u) => u.codigo === codigo)!;
  return { id: ut.codigo, nome: ut.nome, cidade: ut.cidade, uf: ut.uf };
}

function paraTransferencia(s: (typeof conjunto.solicitacoes)[number]): TransferenciaBase {
  const item = conjunto.itens.find((i) => i.id === s.itemId)!;
  return {
    origem: utBase(item.utCodigo),
    destino: utBase(s.utDestinoCodigo),
    quantidade: s.quantidade,
    valorUnitarioSnapshot: s.valorUnitarioSnapshot,
    custoFrete: s.custoFrete,
    concluidaEm: s.concluidaEm,
    itemCriadoEm: item.criadoEm,
  };
}
