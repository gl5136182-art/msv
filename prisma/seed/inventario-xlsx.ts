import { createHash } from "node:crypto";

import { lerDecimalPtBr } from "@/lib/numeros-ptbr";
import { normalizar } from "@/lib/normalizar";

// Leitura do inventário do almoxarifado (planilha `INVENTARIO CONTAGEM.xlsx`, aba "Sisteplant").
// Função pura: recebe a matriz de células (já sem fórmulas) e devolve os itens importáveis e as
// linhas ignoradas, para ser testada sem tocar no disco, no banco nem no storage.
//
// Colunas (pelo cabeçalho, não pela posição): Material (RM), LOCAL, QTD, MARCA, MODELO,
// VALOR UNT (reposição) e Denominação Material (nome). VALOR TT e DESCRIÇÃO 2 são ignoradas.

export const MARCA_NAO_INFORMADA = "Não informada";
export const MODELO_NAO_INFORMADO = "Não informado";

const LIMITE_NOME = 150;
const LIMITE_MARCA_MODELO = 100;
const TAMANHO_RM_MAXIMO = 20;

export type Celula = string | number | null | undefined;

/** Família que decide o fundo da foto genérica. */
export type FamiliaFoto = "chave" | "tomada" | "plugue" | "outros";

export type ItemInventario = {
  /** Determinístico (`inv-rm-<rm>` ou `inv-nome-<hash>`): reexecutar não duplica e a limpeza acha pelo prefixo. */
  id: string;
  /** Número da linha na planilha, para mensagens. */
  linha: number;
  /** Só dígitos; `null` quando a planilha está vazia ou diz "CADASTRAR". */
  rm: string | null;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  quantidade: number;
  valorUnitarioReposicao: number;
  familia: FamiliaFoto;
};

export type MotivoIgnorado = "sem_quantidade" | "sem_valor" | "sem_nome" | "rm_repetido";

export type LinhaIgnorada = {
  linha: number;
  rm: string | null;
  nome: string;
  quantidade: number | null;
  motivo: MotivoIgnorado;
};

export type ResultadoInventario = {
  itens: ItemInventario[];
  ignorados: LinhaIgnorada[];
};

export const PREFIXO_ID_INVENTARIO = "inv-";

const COLUNAS = {
  rm: (cabecalho: string) => cabecalho === "material",
  local: (cabecalho: string) => cabecalho === "local",
  quantidade: (cabecalho: string) => cabecalho === "qtd",
  marca: (cabecalho: string) => cabecalho === "marca",
  modelo: (cabecalho: string) => cabecalho === "modelo",
  valor: (cabecalho: string) => cabecalho === "valor unt",
  // "Denominação Material": o `ç`/`ã` chegam quebrados em algumas exportações, por isso só o início.
  nome: (cabecalho: string) => cabecalho.startsWith("denomina"),
} as const;

type Coluna = keyof typeof COLUNAS;

function texto(celula: Celula): string {
  if (celula === null || celula === undefined) return "";
  return String(celula).replace(/\s+/g, " ").trim();
}

function numero(celula: Celula): number | null {
  if (celula === null || celula === undefined || celula === "") return null;
  if (typeof celula === "number") return Number.isFinite(celula) ? celula : null;
  const lido = lerDecimalPtBr(String(celula));
  return Number.isNaN(lido) ? null : lido;
}

/** RM da Manserv vem como `08.037.0172`: só os dígitos. Vazio, `CADASTRAR` ou texto sem dígitos → `null`. */
export function rmSoDigitos(celula: Celula): string | null {
  const bruto = texto(celula);
  if (bruto === "" || /[a-z]/i.test(bruto)) return null;
  const digitos = bruto.replace(/\D/g, "");
  if (digitos === "" || digitos.length > TAMANHO_RM_MAXIMO) return null;
  return digitos;
}

function familiaDoNome(nome: string): FamiliaFoto {
  const primeira = normalizar(nome).split(" ")[0];
  if (primeira === "chave") return "chave";
  if (primeira === "tomada") return "tomada";
  if (primeira === "plugue") return "plugue";
  return "outros";
}

function idDoItem(rm: string | null, nome: string): string {
  if (rm) return `${PREFIXO_ID_INVENTARIO}rm-${rm}`;
  const hash = createHash("sha1").update(normalizar(nome)).digest("hex").slice(0, 12);
  return `${PREFIXO_ID_INVENTARIO}nome-${hash}`;
}

/** Acha a linha do cabeçalho (a que tem "Material" e "QTD") e o índice de cada coluna. */
function localizarCabecalho(matriz: Celula[][]): { linha: number; indices: Record<Coluna, number> } {
  for (let i = 0; i < Math.min(matriz.length, 20); i++) {
    const cabecalhos = matriz[i].map((c) => normalizar(texto(c)));
    const indices = {} as Record<Coluna, number>;
    for (const coluna of Object.keys(COLUNAS) as Coluna[]) {
      indices[coluna] = cabecalhos.findIndex((c) => COLUNAS[coluna](c));
    }
    if (indices.rm >= 0 && indices.quantidade >= 0) {
      const faltando = (Object.keys(COLUNAS) as Coluna[]).filter((c) => indices[c] < 0);
      if (faltando.length > 0) {
        throw new Error(`Planilha sem a(s) coluna(s): ${faltando.join(", ")}. Confira o cabeçalho.`);
      }
      return { linha: i, indices };
    }
  }
  throw new Error('Não achei o cabeçalho da planilha (colunas "Material" e "QTD" nas primeiras 20 linhas).');
}

export function interpretarInventario(matriz: Celula[][]): ResultadoInventario {
  const { linha: linhaCabecalho, indices } = localizarCabecalho(matriz);
  const itens: ItemInventario[] = [];
  const ignorados: LinhaIgnorada[] = [];
  const idsVistos = new Set<string>();

  for (let i = linhaCabecalho + 1; i < matriz.length; i++) {
    const linha = matriz[i];
    const numeroDaLinha = i + 1;
    const celula = (coluna: Coluna): Celula => linha[indices[coluna]];

    const nomeCompleto = texto(celula("nome"));
    const rm = rmSoDigitos(celula("rm"));
    const quantidadeLida = numero(celula("quantidade"));

    // Linha em branco (rodapé, separador): nada a relatar.
    if (nomeCompleto === "" && rm === null && quantidadeLida === null && texto(celula("rm")) === "") continue;

    const base = { linha: numeroDaLinha, rm, nome: nomeCompleto, quantidade: quantidadeLida };

    if (nomeCompleto === "") {
      ignorados.push({ ...base, motivo: "sem_nome" });
      continue;
    }
    if (quantidadeLida === null || quantidadeLida <= 0) {
      ignorados.push({ ...base, motivo: "sem_quantidade" });
      continue;
    }
    const valor = numero(celula("valor"));
    if (valor === null || valor <= 0) {
      ignorados.push({ ...base, motivo: "sem_valor" });
      continue;
    }

    const quantidade = Math.floor(quantidadeLida);
    const id = idDoItem(rm, nomeCompleto);
    if (idsVistos.has(id)) {
      ignorados.push({ ...base, motivo: "rm_repetido" });
      continue;
    }
    idsVistos.add(id);

    const local = texto(celula("local"));
    const partesDaDescricao: string[] = [];
    if (nomeCompleto.length > LIMITE_NOME) partesDaDescricao.push(`Denominação completa: ${nomeCompleto}`);
    if (local !== "") partesDaDescricao.push(`Local no estoque: ${local}`);

    itens.push({
      id,
      linha: numeroDaLinha,
      rm,
      nome: nomeCompleto.slice(0, LIMITE_NOME),
      marca: texto(celula("marca")).slice(0, LIMITE_MARCA_MODELO) || MARCA_NAO_INFORMADA,
      modelo: texto(celula("modelo")).slice(0, LIMITE_MARCA_MODELO) || MODELO_NAO_INFORMADO,
      descricao: partesDaDescricao.length > 0 ? partesDaDescricao.join("\n") : null,
      quantidade,
      valorUnitarioReposicao: Math.round(valor * 100) / 100,
      familia: familiaDoNome(nomeCompleto),
    });
  }

  return { itens, ignorados };
}

export const ROTULO_MOTIVO: Record<MotivoIgnorado, string> = {
  sem_quantidade: "QTD vazia ou zero",
  sem_valor: "sem VALOR UNT",
  sem_nome: "sem Denominação Material",
  rm_repetido: "RM/nome repetido na planilha",
};

/** CSV (`;`, UTF-8 com BOM, abre direto no Excel) das linhas ignoradas, para completar e reimportar. */
export function ignoradosParaCsv(ignorados: LinhaIgnorada[]): string {
  const campo = (valor: string | number | null): string => {
    const t = valor === null ? "" : String(valor);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const linhas = ignorados.map((l) =>
    [l.linha, l.rm ?? "", l.nome, l.quantidade ?? "", ROTULO_MOTIVO[l.motivo]].map(campo).join(";"),
  );
  return `﻿${["linha;rm;nome;qtd;motivo", ...linhas].join("\r\n")}\r\n`;
}
