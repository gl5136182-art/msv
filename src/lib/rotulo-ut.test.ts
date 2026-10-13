import { describe, expect, it } from "vitest";

import { rotuloUt } from "@/lib/rotulo-ut";

describe("rotuloUt", () => {
  it('monta "Nome · Cidade/UF"', () => {
    expect(rotuloUt({ nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" })).toBe(
      "BASE OPERACIONAL PARADAS · Uberaba/MG",
    );
  });
});
