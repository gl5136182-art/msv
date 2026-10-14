import { describe, expect, it } from "vitest";

import {
  formatarData,
  formatarDataHora,
  formatarDataRelativa,
  formatarMoeda,
  formatarMoedaCompacta,
  formatarMoedaResumida,
  formatarNumero,
  formatarQuantidade,
} from "@/lib/formatacao";

const NBSP = " ";

describe("formatarMoeda", () => {
  it("usa ponto de milhar, vírgula decimal e sempre 2 casas", () => {
    expect(formatarMoeda(1234.5)).toBe(`R$${NBSP}1.234,50`);
    expect(formatarMoeda(12300)).toBe(`R$${NBSP}12.300,00`);
    expect(formatarMoeda(0)).toBe(`R$${NBSP}0,00`);
  });

  it("formata valores negativos", () => {
    expect(formatarMoeda(-10)).toBe(`-R$${NBSP}10,00`);
  });
});

describe("formatarMoedaResumida", () => {
  it("abaixo de mil mostra o valor completo", () => {
    expect(formatarMoedaResumida(950)).toBe(`R$${NBSP}950,00`);
  });

  it("abrevia milhares com 'mil' e uma casa", () => {
    expect(formatarMoedaResumida(1_000)).toBe(`R$${NBSP}1${NBSP}mil`);
    expect(formatarMoedaResumida(912_340)).toBe(`R$${NBSP}912,3${NBSP}mil`);
    expect(formatarMoedaResumida(-12_500)).toBe(`-R$${NBSP}12,5${NBSP}mil`);
  });

  it("de 1 milhão em diante segue o formato compacto, sem '1.000 mil'", () => {
    expect(formatarMoedaResumida(999_990)).toBe(`R$${NBSP}1${NBSP}mi`);
    expect(formatarMoedaResumida(1_234_567)).toBe(`R$${NBSP}1,2${NBSP}mi`);
  });
});

describe("formatarMoedaCompacta", () => {
  it("abaixo de 1 milhão mostra o valor completo", () => {
    expect(formatarMoedaCompacta(12300)).toBe(`R$${NBSP}12.300,00`);
    expect(formatarMoedaCompacta(999_999)).toBe(`R$${NBSP}999.999,00`);
  });

  it("de 1 milhão em diante abrevia com 'mi' e uma casa", () => {
    expect(formatarMoedaCompacta(1_234_567)).toBe(`R$${NBSP}1,2${NBSP}mi`);
    expect(formatarMoedaCompacta(1_000_000)).toBe(`R$${NBSP}1${NBSP}mi`);
    expect(formatarMoedaCompacta(12_340_000)).toBe(`R$${NBSP}12,3${NBSP}mi`);
  });

  it("de 1 bilhão em diante abrevia com 'bi'", () => {
    expect(formatarMoedaCompacta(2_500_000_000)).toBe(`R$${NBSP}2,5${NBSP}bi`);
  });

  it("abrevia também valores negativos", () => {
    expect(formatarMoedaCompacta(-1_500_000)).toBe(`-R$${NBSP}1,5${NBSP}mi`);
  });
});

describe("formatarNumero", () => {
  it("separa milhares com ponto", () => {
    expect(formatarNumero(1547)).toBe("1.547");
    expect(formatarNumero(1_234_567)).toBe("1.234.567");
  });

  it("respeita o número de casas decimais", () => {
    expect(formatarNumero(1234.5, 2)).toBe("1.234,50");
    expect(formatarNumero(0.5, 0, 2)).toBe("0,5");
    expect(formatarNumero(2.456, 0, 2)).toBe("2,46");
  });

  it("arredonda para inteiro por padrão", () => {
    expect(formatarNumero(2.6)).toBe("3");
  });
});

describe("formatarQuantidade", () => {
  it("junta o número formatado e a unidade", () => {
    expect(formatarQuantidade(1547, "un")).toBe(`1.547${NBSP}un`);
    expect(formatarQuantidade(3, "cx")).toBe(`3${NBSP}cx`);
  });
});

describe("formatarDataHora", () => {
  it("converte de UTC para America/Sao_Paulo (UTC-3)", () => {
    expect(formatarDataHora("2026-10-13T13:21:00Z")).toBe("13/10/2026 10:21");
  });

  it("muda o dia quando a hora UTC cruza a meia-noite local", () => {
    expect(formatarDataHora("2026-10-14T02:30:00Z")).toBe("13/10/2026 23:30");
  });

  it("mostra meia-noite como 00:00 (e não 24:00)", () => {
    expect(formatarDataHora("2026-10-13T03:00:00Z")).toBe("13/10/2026 00:00");
  });

  it("aceita Date", () => {
    expect(formatarDataHora(new Date("2026-01-05T15:05:00Z"))).toBe("05/01/2026 12:05");
  });

  it("lança erro para data inválida", () => {
    expect(() => formatarDataHora("não é data")).toThrow(RangeError);
  });
});

describe("formatarData", () => {
  it("mostra só a data no fuso de São Paulo", () => {
    expect(formatarData("2026-10-14T02:30:00Z")).toBe("13/10/2026");
  });
});

describe("formatarDataRelativa", () => {
  const agora = new Date("2026-10-14T15:00:00Z");

  it.each([
    ["2026-10-14T14:59:40Z", "agora"],
    ["2026-10-14T14:55:00Z", "há 5 min"],
    ["2026-10-14T14:01:00Z", "há 59 min"],
    ["2026-10-14T12:00:00Z", "há 3 h"],
    ["2026-10-13T15:00:00Z", "há 1 d"],
    ["2026-10-08T15:00:00Z", "há 6 d"],
  ])("%s → %s", (data, esperado) => {
    expect(formatarDataRelativa(data, agora)).toBe(esperado);
  });

  it("depois de 7 dias mostra a data", () => {
    expect(formatarDataRelativa("2026-10-07T15:00:00Z", agora)).toBe("07/10/2026");
  });

  it("data no futuro mostra a data em vez de um tempo negativo", () => {
    expect(formatarDataRelativa("2026-10-15T15:00:00Z", agora)).toBe("15/10/2026");
  });
});
