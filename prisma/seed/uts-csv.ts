import { utSchema, type UtEntrada } from "@/modules/uts/uts.schemas";

// Leitura e validação do prisma/seed/uts.csv (SPEC §6.0): colunas `codigo,nome,cidade,uf`.
// Função pura (recebe o texto do arquivo), para ser testada sem tocar no disco nem no banco.
// Qualquer linha sem código, nome, cidade ou UF válida derruba o seed com erro claro.

const COLUNAS = ["codigo", "nome", "cidade", "uf"] as const;

export type ResultadoDaLeitura = { uts: UtEntrada[]; erros: string[] };

export function lerUtsDoCsv(conteudo: string): ResultadoDaLeitura {
  const linhas = conteudo
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((texto, indice) => ({ texto, numero: indice + 1 }))
    .filter((linha) => linha.texto.trim() !== "");

  if (linhas.length === 0) {
    return { uts: [], erros: ["uts.csv está vazio: faltam o cabeçalho e as UTs."] };
  }

  const cabecalho = separarCampos(linhas[0].texto).map((campo) => campo.trim().toLowerCase());
  if (COLUNAS.some((coluna, i) => cabecalho[i] !== coluna) || cabecalho.length !== COLUNAS.length) {
    return {
      uts: [],
      erros: [`uts.csv: o cabeçalho deve ser "${COLUNAS.join(",")}" (encontrado: "${linhas[0].texto.trim()}").`],
    };
  }

  const uts: UtEntrada[] = [];
  const erros: string[] = [];
  const codigosVistos = new Map<string, number>();

  for (const { texto, numero } of linhas.slice(1)) {
    const campos = separarCampos(texto);
    if (campos.length !== COLUNAS.length) {
      erros.push(`uts.csv, linha ${numero}: esperadas ${COLUNAS.length} colunas e encontradas ${campos.length}.`);
      continue;
    }

    const [codigo, nome, cidade, uf] = campos;
    const validacao = utSchema.safeParse({ codigo, nome, cidade, uf });
    if (!validacao.success) {
      for (const problema of validacao.error.issues) {
        erros.push(`uts.csv, linha ${numero}: ${problema.message}`);
      }
      continue;
    }

    const anterior = codigosVistos.get(validacao.data.codigo);
    if (anterior !== undefined) {
      erros.push(
        `uts.csv, linha ${numero}: o código ${validacao.data.codigo} já aparece na linha ${anterior}.`,
      );
      continue;
    }
    codigosVistos.set(validacao.data.codigo, numero);
    uts.push(validacao.data);
  }

  return { uts, erros };
}

/** Separa por vírgula, respeitando campos entre aspas (`"Nome, com vírgula"`). */
function separarCampos(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let entreAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (entreAspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') {
        entreAspas = false;
      } else {
        atual += c;
      }
    } else if (c === '"') {
      entreAspas = true;
    } else if (c === ",") {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos;
}
