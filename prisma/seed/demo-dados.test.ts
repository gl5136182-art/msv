import { describe, expect, it } from "vitest";

import { cpfValido } from "@/lib/cpf";
import { resumirEstoque, valorParadoPorCategoria } from "@/modules/dashboard/dashboard.regras";

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

  it("indicadores do dashboard batem com uma conta independente sobre os dados", () => {
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
  });
});

function utBase(codigo: string) {
  const ut = conjunto.uts.find((u) => u.codigo === codigo)!;
  return { id: ut.codigo, nome: ut.nome, cidade: ut.cidade, uf: ut.uf };
}
