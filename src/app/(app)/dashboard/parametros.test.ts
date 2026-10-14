import { describe, expect, it } from "vitest";

import { filtrosDosParametros, hrefDashboard } from "./parametros";

describe("filtrosDosParametros", () => {
  it("sem parâmetros: 12 meses e UT no padrão do papel", () => {
    expect(filtrosDosParametros({})).toEqual({ periodo: "12m", utId: undefined, categoria: undefined });
  });

  it("lê período, UT e categoria", () => {
    expect(filtrosDosParametros({ periodo: "6m", ut: "abc", categoria: "ativo" })).toEqual({
      periodo: "6m",
      utId: "abc",
      categoria: "ativo",
    });
    expect(filtrosDosParametros({ ut: "todas" }).utId).toBe("todas");
  });

  it("valores inválidos voltam ao padrão", () => {
    expect(filtrosDosParametros({ periodo: "99m", categoria: "outra", ut: "" })).toEqual({
      periodo: "12m",
      utId: undefined,
      categoria: undefined,
    });
  });
});

describe("hrefDashboard", () => {
  it("omite o que é padrão", () => {
    expect(hrefDashboard({ periodo: "12m" })).toBe("/dashboard");
    expect(hrefDashboard({ periodo: "3m", utId: "todas", categoria: "material" })).toBe(
      "/dashboard?periodo=3m&ut=todas&categoria=material",
    );
  });
});
