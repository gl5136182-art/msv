import { describe, expect, it } from "vitest";

import { itemEstaAtivo, itensDoPapel } from "./itens-navegacao";

const rotulos = (papel: Parameters<typeof itensDoPapel>[0]) => itensDoPapel(papel).map((i) => i.rotulo);

describe("itensDoPapel (DESIGN §5)", () => {
  it("colaborador: Vitrine, Solicitações, Requisições e Dashboard", () => {
    expect(rotulos("colaborador")).toEqual(["Vitrine", "Solicitações", "Requisições", "Dashboard"]);
  });

  it("almoxarife: Vitrine, Meus itens, Solicitações, Requisições e Dashboard", () => {
    expect(rotulos("almoxarife")).toEqual(["Vitrine", "Meus itens", "Solicitações", "Requisições", "Dashboard"]);
  });

  it("admin: Vitrine, Requisições (só consulta), Dashboard e Administração", () => {
    expect(rotulos("admin")).toEqual(["Vitrine", "Requisições", "Dashboard", "Administração"]);
  });
});

describe("itemEstaAtivo", () => {
  it("marca a rota e as filhas, mas não rotas com o mesmo prefixo", () => {
    expect(itemEstaAtivo("/vitrine", "/vitrine")).toBe(true);
    expect(itemEstaAtivo("/vitrine", "/vitrine/abc")).toBe(true);
    expect(itemEstaAtivo("/vitrine", "/vitrines")).toBe(false);
  });
});
