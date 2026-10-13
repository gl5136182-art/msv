import { describe, expect, it } from "vitest";

import { filtrosDosParametros, hrefVitrine, temFiltros } from "./parametros";

describe("filtrosDosParametros", () => {
  it("URL limpa dá os padrões", () => {
    expect(filtrosDosParametros({})).toEqual({ ordenar: "recentes", pagina: 1 });
  });

  it("lê os parâmetros da vitrine", () => {
    expect(
      filtrosDosParametros({
        q: "furadeira",
        categoria: "ativo",
        segmento: "oleo_gas",
        uf: "sp",
        ut: "ut9",
        condicao: "usado_bom",
        ordem: "maior_valor",
        pagina: "2",
      }),
    ).toEqual({
      busca: "furadeira",
      categoria: "ativo",
      segmento: "oleo_gas",
      uf: "SP",
      utId: "ut9",
      estado: "usado_bom",
      ordenar: "maior_valor",
      pagina: 2,
    });
  });

  it("campos vazios do formulário viram padrão", () => {
    const f = filtrosDosParametros({
      q: "",
      categoria: "",
      segmento: "",
      uf: "",
      ut: "",
      condicao: "",
      ordem: "",
      pagina: "",
    });
    expect(f.categoria).toBeUndefined();
    expect(f.segmento).toBeUndefined();
    expect(f.uf).toBeUndefined();
    expect(f.utId).toBeUndefined();
    expect(f.estado).toBeUndefined();
    expect(f.ordenar).toBe("recentes");
    expect(f.pagina).toBe(1);
    expect(temFiltros(f)).toBe(false);
  });

  it("repetição do parâmetro usa o primeiro valor", () => {
    expect(filtrosDosParametros({ q: ["a", "b"] }).busca).toBe("a");
  });
});

describe("hrefVitrine", () => {
  const base = filtrosDosParametros({ q: "cabo de aço", uf: "MG", ordem: "maior_valor", pagina: "3" });

  it("sem filtros é só /vitrine", () => {
    expect(hrefVitrine(filtrosDosParametros({}))).toBe("/vitrine");
  });

  it("mantém os filtros e codifica o termo", () => {
    expect(hrefVitrine(base)).toBe("/vitrine?q=cabo+de+a%C3%A7o&uf=MG&ordem=maior_valor&pagina=3");
  });

  it("aplica alterações e omite os padrões", () => {
    expect(hrefVitrine(base, { pagina: 1, ordenar: "recentes" })).toBe("/vitrine?q=cabo+de+a%C3%A7o&uf=MG");
    expect(hrefVitrine(base, { pagina: 4 })).toContain("pagina=4");
  });
});
