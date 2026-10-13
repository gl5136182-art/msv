import { describe, expect, it } from "vitest";

import { calcularDimensoes } from "./comprimir-imagem";

describe("calcularDimensoes", () => {
  it("reduz paisagem pelo lado maior (largura)", () => {
    expect(calcularDimensoes(4000, 3000, 1600)).toEqual({ largura: 1600, altura: 1200 });
  });

  it("reduz retrato pelo lado maior (altura)", () => {
    expect(calcularDimensoes(3000, 4000, 1600)).toEqual({ largura: 1200, altura: 1600 });
  });

  it("gera a miniatura de 400px mantendo a proporção", () => {
    expect(calcularDimensoes(4000, 3000, 400)).toEqual({ largura: 400, altura: 300 });
  });

  it("não amplia imagem menor que o limite", () => {
    expect(calcularDimensoes(800, 600, 1600)).toEqual({ largura: 800, altura: 600 });
  });

  it("mantém imagem exatamente no limite", () => {
    expect(calcularDimensoes(1600, 900, 1600)).toEqual({ largura: 1600, altura: 900 });
  });

  it("nunca devolve lado menor que 1px", () => {
    expect(calcularDimensoes(10000, 1, 400)).toEqual({ largura: 400, altura: 1 });
  });
});
