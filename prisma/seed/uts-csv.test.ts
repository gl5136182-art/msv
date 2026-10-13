import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lerUtsDoCsv } from "./uts-csv";

describe("lerUtsDoCsv", () => {
  it("lê as 3 UTs reais do arquivo do repositório", () => {
    const conteudo = readFileSync(join(process.cwd(), "prisma/seed/uts.csv"), "utf8");
    const { uts, erros } = lerUtsDoCsv(conteudo);

    expect(erros).toEqual([]);
    expect(uts).toEqual([
      { codigo: "9.04.0447.009", nome: "YARA FERTILIZANTES CUB1", cidade: "Cubatão", uf: "SP" },
      { codigo: "06.00.0171.256", nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" },
      { codigo: "09.06.0001.171", nome: "Mosaic Fertilizantes do Brasil Ltda", cidade: "Uberaba", uf: "MG" },
    ]);
  });

  it("aceita BOM, CRLF, linhas em branco e campos entre aspas com vírgula", () => {
    const csv = '﻿codigo,nome,cidade,uf\r\n\r\n01.01,"Base, Norte",Manaus,am\r\n';
    const { uts, erros } = lerUtsDoCsv(csv);

    expect(erros).toEqual([]);
    expect(uts).toEqual([{ codigo: "01.01", nome: "Base, Norte", cidade: "Manaus", uf: "AM" }]);
  });

  it("aponta a linha quando falta a cidade", () => {
    const { uts, erros } = lerUtsDoCsv("codigo,nome,cidade,uf\n01.01,Base,,SP\n");

    expect(uts).toEqual([]);
    expect(erros).toEqual(["uts.csv, linha 2: Informe a cidade."]);
  });

  it("aponta a linha quando falta a UF ou ela é inválida", () => {
    const { erros } = lerUtsDoCsv("codigo,nome,cidade,uf\n01.01,Base,Santos,\n02.02,Outra,Recife,XX\n");

    expect(erros).toEqual(["uts.csv, linha 2: Selecione a UF.", "uts.csv, linha 3: Selecione a UF."]);
  });

  it("recusa linha com número de colunas errado", () => {
    const { erros } = lerUtsDoCsv("codigo,nome,cidade,uf\n01.01,Base,Santos\n");
    expect(erros).toEqual(["uts.csv, linha 2: esperadas 4 colunas e encontradas 3."]);
  });

  it("recusa código repetido no arquivo", () => {
    const { uts, erros } = lerUtsDoCsv("codigo,nome,cidade,uf\n01.01,Base A,Santos,SP\n01.01,Base B,Recife,PE\n");

    expect(uts).toHaveLength(1);
    expect(erros).toEqual(["uts.csv, linha 3: o código 01.01 já aparece na linha 2."]);
  });

  it("recusa cabeçalho diferente do esperado e arquivo vazio", () => {
    expect(lerUtsDoCsv("codigo,nome,uf,cidade\n").erros[0]).toContain('o cabeçalho deve ser "codigo,nome,cidade,uf"');
    expect(lerUtsDoCsv("").erros[0]).toContain("está vazio");
  });
});
