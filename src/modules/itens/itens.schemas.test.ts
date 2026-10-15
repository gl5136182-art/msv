import { describe, expect, it } from "vitest";

import { ajustarQuantidadeSchema, editarItemSchema, itemSchema } from "./itens.schemas";

const FOTO = {
  chave: "fotos/2026/10/123e4567-e89b-12d3-a456-426614174000.jpg",
  chaveThumb: "fotos/2026/10/123e4567-e89b-12d3-a456-426614174000_thumb.jpg",
};

const valida = {
  nome: "  Furadeira de impacto ",
  rm: "123456",
  categoria: "material",
  valorDepreciacaoMensal: "",
  segmento: "industrial",
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
  larguraLoteCm: "",
  alturaLoteCm: "",
  profundidadeLoteCm: "",
  pesoLoteKg: "",
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

  it("aceita os campos opcionais ausentes (chamada direta da action)", () => {
    const { valorDepreciacaoMensal, larguraLoteCm, alturaLoteCm, profundidadeLoteCm, pesoLoteKg, ...resto } = valida;
    void [valorDepreciacaoMensal, larguraLoteCm, alturaLoteCm, profundidadeLoteCm, pesoLoteKg];
    expect(itemSchema.safeParse(resto).success).toBe(true);
  });

  it.each([
    ["nome", { nome: "   " }],
    ["categoria", { categoria: "" }],
    ["categoria antiga", { categoria: "ferramentas" }],
    ["segmento", { segmento: "" }],
    ["segmento inexistente", { segmento: "varejo" }],
    ["marca", { marca: "" }],
    ["modelo", { modelo: "" }],
    ["condição", { estado: "" }],
    ["condição removida (usado regular)", { estado: "usado_regular" }],
    ["unidade", { unidade: "duzia" }],
    ["quantidade zero", { quantidade: "0" }],
    ["quantidade fracionada", { quantidade: "1,5" }],
    ["quantidade vazia", { quantidade: "" }],
    ["valor vazio", { valorUnitarioReposicao: "" }],
    ["valor zero", { valorUnitarioReposicao: "R$ 0,00" }],
    ["altura zero", { alturaCm: "0" }],
    ["profundidade negativa", { profundidadeCm: "-3" }],
    ["peso inválido", { pesoKg: "abc" }],
    ["sem fotos", { fotos: [] }],
    ["mais de 5 fotos", { fotos: Array.from({ length: 6 }, () => FOTO) }],
    ["chave de foto fora do padrão", { fotos: [{ chave: "../x.jpg", chaveThumb: FOTO.chaveThumb }] }],
  ])("recusa %s", (_nome, parcial) => {
    expect(itemSchema.safeParse({ ...valida, ...parcial }).success).toBe(false);
  });

  it("aceita as 3 condições: novo, usado bom e com defeito", () => {
    for (const estado of ["novo", "usado_bom", "com_defeito"]) {
      expect(itemSchema.parse({ ...valida, estado }).estado).toBe(estado);
    }
  });

  it("dimensões e peso são opcionais, cada um por si (SPEC §6.1, item 4)", () => {
    for (const campo of ["larguraCm", "alturaCm", "profundidadeCm", "pesoKg"] as const) {
      const ausente = Object.fromEntries(Object.entries(valida).filter(([chave]) => chave !== campo));
      expect(itemSchema.parse(ausente)[campo]).toBeUndefined();

      expect(itemSchema.parse({ ...valida, [campo]: "" })[campo]).toBeUndefined();
      expect(itemSchema.parse({ ...valida, [campo]: "   " })[campo]).toBeUndefined();
    }
  });

  it("aceita item sem nenhuma medida nem peso", () => {
    const resultado = itemSchema.safeParse({ ...valida, larguraCm: "", alturaCm: "", profundidadeCm: "", pesoKg: "" });
    expect(resultado.success).toBe(true);
  });

  it("uma medida preenchida continua sendo validada", () => {
    expect(itemSchema.safeParse({ ...valida, larguraCm: "abc" }).success).toBe(false);
    expect(itemSchema.safeParse({ ...valida, larguraCm: "0" }).success).toBe(false);
  });

  it("arredonda medidas e valores para 2 casas", () => {
    const r = itemSchema.parse({ ...valida, pesoKg: "1,239", valorUnitarioReposicao: 10.005 });
    expect(r.pesoKg).toBe(1.24);
    expect(r.valorUnitarioReposicao).toBe(10.01);
  });
});

describe("itemSchema: RM", () => {
  it("aceita só dígitos e mantém os zeros à esquerda", () => {
    expect(itemSchema.parse({ ...valida, rm: " 000123 " }).rm).toBe("000123");
  });

  it.each([["vazio", ""], ["com letras", "RM123"], ["com pontuação", "12.345"], ["com espaço", "12 34"], ["longo demais", "1".repeat(21)]])(
    "recusa RM %s",
    (_nome, rm) => {
      expect(itemSchema.safeParse({ ...valida, rm }).success).toBe(false);
    },
  );

  it("aceita 20 dígitos", () => {
    expect(itemSchema.safeParse({ ...valida, rm: "9".repeat(20) }).success).toBe(true);
  });
});

describe("itemSchema: categoria e depreciação", () => {
  it('"Ativo" exige o valor de depreciação, e a mensagem aponta o campo', () => {
    const r = itemSchema.safeParse({ ...valida, categoria: "ativo", valorDepreciacaoMensal: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      path: ["valorDepreciacaoMensal"],
      message: "Informe o valor de depreciação mensal.",
    });
  });

  it('"Ativo" com depreciação informada em texto (R$) ou número', () => {
    expect(itemSchema.parse({ ...valida, categoria: "ativo", valorDepreciacaoMensal: "R$ 250,00" })).toMatchObject({
      categoria: "ativo",
      valorDepreciacaoMensal: 250,
    });
    expect(itemSchema.parse({ ...valida, categoria: "ativo", valorDepreciacaoMensal: 99.9 }).valorDepreciacaoMensal).toBe(
      99.9,
    );
  });

  it('"Ativo" recusa depreciação zero', () => {
    expect(itemSchema.safeParse({ ...valida, categoria: "ativo", valorDepreciacaoMensal: "R$ 0,00" }).success).toBe(
      false,
    );
  });

  it('"Material" não precisa de depreciação e descarta o valor enviado', () => {
    expect(itemSchema.parse({ ...valida, categoria: "material" }).valorDepreciacaoMensal).toBeUndefined();
    expect(
      itemSchema.parse({ ...valida, categoria: "material", valorDepreciacaoMensal: "R$ 100,00" })
        .valorDepreciacaoMensal,
    ).toBeUndefined();
  });
});

describe("itemSchema: dimensões e peso do lote", () => {
  const lote = { larguraLoteCm: "120", alturaLoteCm: "80,5", profundidadeLoteCm: "100", pesoLoteKg: "350" };

  it("é opcional: sem os 4 campos o item é válido", () => {
    const r = itemSchema.parse(valida);
    expect(r.larguraLoteCm).toBeUndefined();
    expect(r.pesoLoteKg).toBeUndefined();
  });

  it("aceita os 4 campos preenchidos, com vírgula decimal", () => {
    expect(itemSchema.parse({ ...valida, ...lote })).toMatchObject({
      larguraLoteCm: 120,
      alturaLoteCm: 80.5,
      profundidadeLoteCm: 100,
      pesoLoteKg: 350,
    });
  });

  it("é tudo ou nada: com 1 a 3 campos, aponta os que faltam", () => {
    const r = itemSchema.safeParse({ ...valida, larguraLoteCm: "120", pesoLoteKg: "350" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0]).sort()).toEqual(["alturaLoteCm", "profundidadeLoteCm"]);
    expect(r.error?.issues[0].message).toBe("Preencha os 4 campos do lote ou deixe todos em branco.");
  });

  it("recusa valor inválido no lote", () => {
    expect(itemSchema.safeParse({ ...valida, ...lote, pesoLoteKg: "-5" }).success).toBe(false);
    expect(itemSchema.safeParse({ ...valida, ...lote, larguraLoteCm: "abc" }).success).toBe(false);
  });
});

describe("editarItemSchema", () => {
  const { quantidade, ...semQuantidade } = valida;
  void quantidade;

  it("não exige a quantidade, mas exige o id e as mesmas regras do cadastro", () => {
    expect(editarItemSchema.safeParse({ ...semQuantidade, id: "item1" }).success).toBe(true);
    expect(editarItemSchema.safeParse({ ...semQuantidade }).success).toBe(false);
    expect(editarItemSchema.safeParse({ ...semQuantidade, id: "item1", rm: "abc" }).success).toBe(false);
    expect(
      editarItemSchema.safeParse({ ...semQuantidade, id: "item1", categoria: "ativo", valorDepreciacaoMensal: "" })
        .success,
    ).toBe(false);
    expect(editarItemSchema.safeParse({ ...semQuantidade, id: "item1", larguraLoteCm: "10" }).success).toBe(false);
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
