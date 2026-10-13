import { describe, expect, it } from "vitest";

import { normalizar } from "@/lib/normalizar";

describe("normalizar", () => {
  it("põe em minúsculas e tira acentos", () => {
    expect(normalizar("Cubatão")).toBe("cubatao");
    expect(normalizar("FURADEIRA DE IMPACTO")).toBe("furadeira de impacto");
    expect(normalizar("Ação Coração Pão Ânima Ûltimo")).toBe("acao coracao pao anima ultimo");
  });

  it("tira ç e mantém o resto", () => {
    expect(normalizar("Peças e Conexões")).toBe("pecas e conexoes");
  });

  it("junta espaços repetidos e apara as pontas", () => {
    expect(normalizar("  base   operacional \t paradas ")).toBe("base operacional paradas");
  });

  it("é idempotente e aceita texto vazio", () => {
    expect(normalizar(normalizar("Uberaba/MG"))).toBe("uberaba/mg");
    expect(normalizar("")).toBe("");
  });
});
