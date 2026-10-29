import { describe, expect, it } from "vitest";

import { itemEstaAtivo, itensDoPapel } from "./itens-navegacao";

const rotulos = (papel: Parameters<typeof itensDoPapel>[0]) => itensDoPapel(papel).map((i) => i.rotulo);

describe("itensDoPapel (DESIGN §5)", () => {
  it("colaborador: Vitrine e Dashboard", () => {
    expect(rotulos("colaborador")).toEqual(["Vitrine", "Dashboard"]);
  });

  it("almoxarife: Vitrine, Meus itens e Dashboard", () => {
    expect(rotulos("almoxarife")).toEqual(["Vitrine", "Meus itens", "Dashboard"]);
  });

  it("admin: Vitrine, Dashboard e Administração", () => {
    expect(rotulos("admin")).toEqual(["Vitrine", "Dashboard", "Administração"]);
  });
});

describe("itemEstaAtivo", () => {
  it("marca a rota e as filhas, mas não rotas com o mesmo prefixo", () => {
    expect(itemEstaAtivo("/vitrine", "/vitrine")).toBe(true);
    expect(itemEstaAtivo("/vitrine", "/vitrine/abc")).toBe(true);
    expect(itemEstaAtivo("/vitrine", "/vitrines")).toBe(false);
  });
});
