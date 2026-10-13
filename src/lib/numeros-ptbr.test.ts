import { describe, expect, it } from "vitest";

import { decimalParaCampo, lerDecimalPtBr, lerMoeda, mascararMoeda, moedaParaCampo } from "./numeros-ptbr";

const NBSP = " ";

describe("mascararMoeda", () => {
  it("trata os dígitos como centavos", () => {
    expect(mascararMoeda("1")).toBe(`R$${NBSP}0,01`);
    expect(mascararMoeda("12")).toBe(`R$${NBSP}0,12`);
    expect(mascararMoeda("12345")).toBe(`R$${NBSP}123,45`);
    expect(mascararMoeda("123456789")).toBe(`R$${NBSP}1.234.567,89`);
  });

  it("ignora o que não é dígito e zeros à esquerda", () => {
    expect(mascararMoeda(`R$${NBSP}1.234,56`)).toBe(`R$${NBSP}1.234,56`);
    expect(mascararMoeda("00012")).toBe(`R$${NBSP}0,12`);
    expect(mascararMoeda("abc")).toBe("");
    expect(mascararMoeda("")).toBe("");
  });

  it("é estável: aplicar de novo não muda o resultado", () => {
    const uma = mascararMoeda("987654");
    expect(mascararMoeda(uma)).toBe(uma);
  });
});

describe("lerMoeda", () => {
  it("volta ao número a partir do campo mascarado", () => {
    expect(lerMoeda(`R$${NBSP}1.234,56`)).toBe(1234.56);
    expect(lerMoeda(`R$${NBSP}0,01`)).toBe(0.01);
  });

  it("devolve NaN quando vazio", () => {
    expect(lerMoeda("")).toBeNaN();
    expect(lerMoeda("R$")).toBeNaN();
  });
});

describe("moedaParaCampo", () => {
  it("formata número existente para edição", () => {
    expect(moedaParaCampo(1234.5)).toBe(`R$${NBSP}1.234,50`);
    expect(moedaParaCampo(0)).toBe(`R$${NBSP}0,00`);
  });
});

describe("lerDecimalPtBr", () => {
  it("lê vírgula como decimal", () => {
    expect(lerDecimalPtBr("12,5")).toBe(12.5);
    expect(lerDecimalPtBr("0,75")).toBe(0.75);
    expect(lerDecimalPtBr("1.234,5")).toBe(1234.5);
  });

  it("lê inteiros", () => {
    expect(lerDecimalPtBr("40")).toBe(40);
    expect(lerDecimalPtBr(" 40 ")).toBe(40);
  });

  it("aceita ponto decimal de teclado em inglês, mas ponto com 3 dígitos é milhar", () => {
    expect(lerDecimalPtBr("12.5")).toBe(12.5);
    expect(lerDecimalPtBr("1.234")).toBe(1234);
    expect(lerDecimalPtBr("1.234.567")).toBe(1234567);
  });

  it("devolve NaN para lixo", () => {
    expect(lerDecimalPtBr("")).toBeNaN();
    expect(lerDecimalPtBr("abc")).toBeNaN();
    expect(lerDecimalPtBr("1,2,3")).toBeNaN();
    expect(lerDecimalPtBr("-5")).toBeNaN();
    expect(lerDecimalPtBr("1e5")).toBeNaN();
  });
});

describe("decimalParaCampo", () => {
  it("usa vírgula", () => {
    expect(decimalParaCampo(12.5)).toBe("12,5");
    expect(decimalParaCampo(40)).toBe("40");
  });
});
