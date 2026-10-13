import { describe, expect, it } from "vitest";

import { utSchema } from "./uts.schemas";

const valida = { codigo: "06.00.0171.256", nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" };

function mensagens(entrada: unknown): string[] {
  const r = utSchema.safeParse(entrada);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("utSchema", () => {
  it("aceita os códigos reais e o formato DEMO-", () => {
    for (const codigo of ["06.00.0171.256", "9.04.0447.009", "09.06.0001.171", "DEMO-01"]) {
      expect(utSchema.safeParse({ ...valida, codigo }).success).toBe(true);
    }
  });

  it("apara espaços e põe a UF em maiúsculas", () => {
    const r = utSchema.parse({ codigo: " 06.00.0171.256 ", nome: " Base ", cidade: " Uberaba ", uf: " mg " });
    expect(r).toEqual({ codigo: "06.00.0171.256", nome: "Base", cidade: "Uberaba", uf: "MG" });
  });

  it("exige código, nome, cidade e UF", () => {
    expect(mensagens({ ...valida, codigo: "" })).toContain("Informe o código da UT.");
    expect(mensagens({ ...valida, nome: " " })).toContain("Informe o nome da UT.");
    expect(mensagens({ ...valida, cidade: "" })).toContain("Informe a cidade.");
    expect(mensagens({ ...valida, uf: "" })).toContain("Selecione a UF.");
  });

  it("valida a UF contra as 27 siglas", () => {
    expect(mensagens({ ...valida, uf: "XX" })).toContain("Selecione a UF.");
    expect(utSchema.safeParse({ ...valida, uf: "sp" }).success).toBe(true);
  });

  it("limita o tamanho do código a 20 caracteres e recusa caracteres estranhos", () => {
    expect(mensagens({ ...valida, codigo: "1".repeat(21) })).toContain("O código deve ter no máximo 20 caracteres.");
    expect(mensagens({ ...valida, codigo: "06 00" })).toContain("Use só letras, números, ponto e hífen no código.");
  });
});
