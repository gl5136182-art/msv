import { describe, expect, it } from "vitest";

import {
  ignoradosParaCsv,
  interpretarInventario,
  MARCA_NAO_INFORMADA,
  MODELO_NAO_INFORMADO,
  rmSoDigitos,
  type Celula,
} from "./inventario-xlsx";

// Mesma forma da aba "Sisteplant": linha 1 com subtotais, cabeçalho na linha 2.
const CABECALHO: Celula[] = [
  "Material",
  "LOCAL",
  "QTD",
  "MARCA",
  "MODELO",
  "VALOR UNT",
  "VALOR TT",
  "DESCRIÇAO 2",
  "Denominação Material",
];

function linha(parcial: {
  rm?: Celula;
  local?: Celula;
  qtd?: Celula;
  marca?: Celula;
  modelo?: Celula;
  valor?: Celula;
  nome?: Celula;
}): Celula[] {
  return [
    parcial.rm ?? null,
    parcial.local ?? null,
    parcial.qtd ?? null,
    parcial.marca ?? null,
    parcial.modelo ?? null,
    parcial.valor ?? null,
    0,
    null,
    parcial.nome ?? null,
  ];
}

function planilha(...linhas: Celula[][]): Celula[][] {
  return [[null, null, 2934, null, null, null, 809849.6], CABECALHO, ...linhas];
}

describe("rmSoDigitos", () => {
  it.each([
    ["08.037.0172", "080370172"],
    ["01.003.00 41", "010030041"],
    ["  70.090.6169 ", "700906169"],
    [123, "123"],
  ])("%s → %s", (entrada, esperado) => {
    expect(rmSoDigitos(entrada)).toBe(esperado);
  });

  it.each([["CADASTRAR"], [""], [null], [undefined], ["1".repeat(21)]])("%s → null", (entrada) => {
    expect(rmSoDigitos(entrada as Celula)).toBeNull();
  });
});

describe("interpretarInventario", () => {
  it("mapeia uma linha completa", () => {
    const { itens, ignorados } = interpretarInventario(
      planilha(
        linha({
          rm: "08.040.0192",
          local: "CAIXA PRETA 03",
          qtd: 17,
          marca: "STELLI",
          modelo: "IMPACTO",
          valor: 260,
          nome: 'CHAVE COMBINADA DE 1 15/16"',
        }),
      ),
    );

    expect(ignorados).toEqual([]);
    expect(itens).toEqual([
      {
        id: "inv-rm-080400192",
        linha: 3,
        rm: "080400192",
        nome: 'CHAVE COMBINADA DE 1 15/16"',
        marca: "STELLI",
        modelo: "IMPACTO",
        descricao: "Local no estoque: CAIXA PRETA 03",
        quantidade: 17,
        valorUnitarioReposicao: 260,
        familia: "chave",
      },
    ]);
  });

  it("marca e modelo vazios viram o texto padrão; aparas e espaços repetidos saem", () => {
    const { itens } = interpretarInventario(
      planilha(
        linha({ rm: "21.039.0007", qtd: 1, valor: 1450, nome: "PLUGUE  2P+T 125A ", marca: "  ", modelo: " S4049W" }),
        linha({ rm: "21.039.0008", qtd: 1, valor: 10, nome: "TOMADA DE IMBUTIR" }),
      ),
    );
    expect(itens[0]).toMatchObject({ nome: "PLUGUE 2P+T 125A", marca: MARCA_NAO_INFORMADA, modelo: "S4049W" });
    expect(itens[0].familia).toBe("plugue");
    expect(itens[1]).toMatchObject({ marca: MARCA_NAO_INFORMADA, modelo: MODELO_NAO_INFORMADO, familia: "tomada" });
  });

  it("sem LOCAL a descrição fica vazia", () => {
    const { itens } = interpretarInventario(planilha(linha({ rm: "1.1", qtd: 2, valor: 5, nome: "ITEM" })));
    expect(itens[0].descricao).toBeNull();
  });

  it("valor com ruído de ponto flutuante é arredondado a 2 casas", () => {
    const { itens } = interpretarInventario(
      planilha(linha({ rm: "08.040.0060", qtd: 33, valor: 38.200000000000003, nome: "CHAVE COMBINADA DE 06MM" })),
    );
    expect(itens[0].valorUnitarioReposicao).toBe(38.2);
  });

  it("RM 'CADASTRAR' e RM vazio entram sem RM, com id pelo nome", () => {
    const { itens } = interpretarInventario(
      planilha(
        linha({ rm: "CADASTRAR", qtd: 5, valor: 390, nome: 'CHAVE ESPINA ESTRIADA DE 1 15/16"' }),
        linha({ qtd: 109, valor: 35.37, nome: "CHAVE COMBINADA DE 24MM" }),
      ),
    );
    expect(itens.map((i) => i.rm)).toEqual([null, null]);
    expect(itens[0].id).toMatch(/^inv-nome-[0-9a-f]{12}$/);
    expect(itens[0].id).not.toBe(itens[1].id);
  });

  it("o id pelo nome não muda com caixa, acento ou espaços", () => {
    const a = interpretarInventario(planilha(linha({ qtd: 1, valor: 1, nome: "Chave  Fixa" }))).itens[0].id;
    const b = interpretarInventario(planilha(linha({ qtd: 1, valor: 1, nome: "CHAVE FIXA " }))).itens[0].id;
    expect(a).toBe(b);
  });

  it("ignora QTD vazia ou zero, sem valor e sem nome, com o motivo", () => {
    const { itens, ignorados } = interpretarInventario(
      planilha(
        linha({ rm: "01.001.0005", nome: "DISCO CORTE" }),
        linha({ rm: "01.001.0043", qtd: 0, valor: 3, nome: "DISCO DESBASTE" }),
        linha({ rm: "06.005.0010", qtd: 141, nome: "CAPACETE SEGURANCA" }),
        linha({ rm: "08.040.0001", qtd: 3, valor: 3 }),
        linha({ rm: "08.040.0002", qtd: 3, valor: 3, nome: "CHAVE OK" }),
      ),
    );
    expect(itens).toHaveLength(1);
    expect(ignorados.map((i) => [i.linha, i.motivo])).toEqual([
      [3, "sem_quantidade"],
      [4, "sem_quantidade"],
      [5, "sem_valor"],
      [6, "sem_nome"],
    ]);
  });

  it("linhas totalmente em branco não aparecem em nenhum relatório", () => {
    const { itens, ignorados } = interpretarInventario(
      planilha(linha({}), linha({ rm: "1.2", qtd: 1, valor: 1, nome: "ITEM" }), linha({})),
    );
    expect(itens).toHaveLength(1);
    expect(ignorados).toEqual([]);
  });

  it("RM repetido na planilha: só a primeira entra", () => {
    const { itens, ignorados } = interpretarInventario(
      planilha(
        linha({ rm: "08.040.0001", qtd: 1, valor: 1, nome: "CHAVE A" }),
        linha({ rm: "08.040.0001", qtd: 2, valor: 2, nome: "CHAVE B" }),
      ),
    );
    expect(itens.map((i) => i.nome)).toEqual(["CHAVE A"]);
    expect(ignorados).toMatchObject([{ linha: 4, motivo: "rm_repetido" }]);
  });

  it("nome acima de 150 caracteres é cortado e o nome completo vai para a descrição", () => {
    const longo = `CHAVE ${"X".repeat(200)}`;
    const { itens } = interpretarInventario(
      planilha(linha({ rm: "1.3", local: "PALETE 01", qtd: 1, valor: 1, nome: longo })),
    );
    expect(itens[0].nome).toHaveLength(150);
    expect(itens[0].descricao).toBe(`Denominação completa: ${longo}\nLocal no estoque: PALETE 01`);
  });

  it("acha as colunas pelo cabeçalho, mesmo com o acento quebrado e fora de ordem", () => {
    const matriz: Celula[][] = [
      ["Denomina��o Material", "QTD", "Material", "VALOR UNT", "MARCA", "MODELO", "LOCAL"],
      ["CHAVE FIXA", 4, "08.001.0001", 12.5, "TRAMONTINA-PRO", null, "PALETE 10"],
    ];
    const { itens } = interpretarInventario(matriz);
    expect(itens[0]).toMatchObject({
      nome: "CHAVE FIXA",
      quantidade: 4,
      rm: "080010001",
      valorUnitarioReposicao: 12.5,
      marca: "TRAMONTINA-PRO",
    });
  });

  it("aceita número em texto pt-BR", () => {
    const { itens } = interpretarInventario(
      planilha(linha({ rm: "1.4", qtd: "1.234", valor: "1.234,50", nome: "ITEM" })),
    );
    expect(itens[0]).toMatchObject({ quantidade: 1234, valorUnitarioReposicao: 1234.5 });
  });

  it("falta de coluna ou de cabeçalho dá erro claro", () => {
    expect(() => interpretarInventario([["Material", "QTD"], ["1", 2]])).toThrow(/coluna/);
    expect(() => interpretarInventario([["a", "b"]])).toThrow(/cabeçalho/);
  });
});

describe("ignoradosParaCsv", () => {
  it("gera CSV com BOM, ';' e aspas escapadas", () => {
    const csv = ignoradosParaCsv([
      { linha: 45, rm: "060050010", nome: 'CAPACETE "TIPO 2"; PEAD', quantidade: 141, motivo: "sem_valor" },
    ]);
    expect(csv).toBe(
      '﻿linha;rm;nome;qtd;motivo\r\n45;060050010;"CAPACETE ""TIPO 2""; PEAD";141;sem VALOR UNT\r\n',
    );
  });
});
