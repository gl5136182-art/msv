import { describe, expect, it } from "vitest";

import { ajustarQuantidadeSchema, itemSchema } from "./itens.schemas";

const FOTO = {
  chave: "fotos/2026/10/123e4567-e89b-12d3-a456-426614174000.jpg",
  chaveThumb: "fotos/2026/10/123e4567-e89b-12d3-a456-426614174000_thumb.jpg",
};

const valida = {
  nome: "  Furadeira de impacto ",
  categoriaId: "cat1",
  marca: "Bosch",
  modelo: "GSB 550",
  descricao: "",
  estado: "usado_bom",
  unidade: "un",
  quantidade: "3",
  valorUnitarioReposicao: "R$ 1.234,56",
  larguraCm: "30,5",
  alturaCm: "25",
  profundidadeCm: "10",
  pesoKg: "2,1",
  fotos: [FOTO],
};

describe("itemSchema", () => {
  it("converte o que o formulário digita: texto aparado, R$ e decimais com vírgula", () => {
    const r = itemSchema.parse(valida);
    expect(r.nome).toBe("Furadeira de impacto");
    expect(r.descricao).toBeUndefined();
    expect(r.quantidade).toBe(3);
    expect(r.valorUnitarioReposicao).toBe(1234.56);
    expect(r.larguraCm).toBe(30.5);
    expect(r.pesoKg).toBe(2.1);
  });

  it("aceita números (chamada direta da action)", () => {
    const r = itemSchema.parse({
      ...valida,
      quantidade: 2,
      valorUnitarioReposicao: 10,
      larguraCm: 1,
      alturaCm: 2,
      profundidadeCm: 3,
      pesoKg: 0.5,
    });
    expect(r.quantidade).toBe(2);
    expect(r.valorUnitarioReposicao).toBe(10);
  });

  it.each([
    ["nome", { nome: "   " }],
    ["categoria", { categoriaId: "" }],
    ["marca", { marca: "" }],
    ["modelo", { modelo: "" }],
    ["condição", { estado: "" }],
    ["unidade", { unidade: "duzia" }],
    ["quantidade zero", { quantidade: "0" }],
    ["quantidade fracionada", { quantidade: "1,5" }],
    ["quantidade vazia", { quantidade: "" }],
    ["valor vazio", { valorUnitarioReposicao: "" }],
    ["valor zero", { valorUnitarioReposicao: "R$ 0,00" }],
    ["largura vazia", { larguraCm: "" }],
    ["altura zero", { alturaCm: "0" }],
    ["profundidade negativa", { profundidadeCm: "-3" }],
    ["peso inválido", { pesoKg: "abc" }],
    ["sem fotos", { fotos: [] }],
    ["mais de 5 fotos", { fotos: Array.from({ length: 6 }, () => FOTO) }],
    ["chave de foto fora do padrão", { fotos: [{ chave: "../x.jpg", chaveThumb: FOTO.chaveThumb }] }],
  ])("recusa %s", (_nome, parcial) => {
    expect(itemSchema.safeParse({ ...valida, ...parcial }).success).toBe(false);
  });

  it("dimensões e peso são obrigatórios (SPEC §6.1, item 4)", () => {
    for (const campo of ["larguraCm", "alturaCm", "profundidadeCm", "pesoKg"] as const) {
      const resto = Object.fromEntries(Object.entries(valida).filter(([chave]) => chave !== campo));
      expect(itemSchema.safeParse(resto).success).toBe(false);
    }
  });

  it("arredonda medidas e valores para 2 casas", () => {
    const r = itemSchema.parse({ ...valida, pesoKg: "1,239", valorUnitarioReposicao: 10.005 });
    expect(r.pesoKg).toBe(1.24);
    expect(r.valorUnitarioReposicao).toBe(10.01);
  });
});

describe("ajustarQuantidadeSchema", () => {
  it("aceita zero e inteiros positivos, em texto ou número", () => {
    expect(ajustarQuantidadeSchema.parse({ id: "i", quantidadeDisponivel: "0" }).quantidadeDisponivel).toBe(0);
    expect(ajustarQuantidadeSchema.parse({ id: "i", quantidadeDisponivel: 12 }).quantidadeDisponivel).toBe(12);
  });

  it.each([["-1"], ["1,5"], [""], ["abc"], [-3]])("recusa %s", (valor) => {
    expect(ajustarQuantidadeSchema.safeParse({ id: "i", quantidadeDisponivel: valor }).success).toBe(false);
  });
});
