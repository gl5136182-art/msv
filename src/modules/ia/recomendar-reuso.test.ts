import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infra/llm", () => ({ completarJson: vi.fn(), iaDisponivel: vi.fn(() => true) }));

import { completarJson } from "@/infra/llm";
import { normalizar } from "@/lib/normalizar";

import {
  alocarQuantidades,
  escolherPorPalavras,
  gerarConsultas,
  julgarCandidatos,
  palavrasChave,
  ranquear,
  type Candidato,
  type LinhaParaAnalise,
} from "./recomendar-reuso";

const llm = vi.mocked(completarJson);

function candidato(id: string, texto: string, quantidadeDisponivel = 5): Candidato {
  return {
    id,
    nome: texto,
    marca: "",
    modelo: "",
    descricao: null,
    estado: "novo",
    unidade: "un",
    quantidadeDisponivel,
    utNome: "UT",
    buscaNormalizada: normalizar(texto),
  };
}

const linha = (descricao: string, quantidade = 2): LinhaParaAnalise => ({
  descricao,
  quantidade,
  unidade: "un",
  observacao: null,
});

beforeEach(() => llm.mockReset());

describe("palavrasChave", () => {
  it("normaliza, tira palavras vazias e passa plurais simples para o singular", () => {
    expect(palavrasChave("Tomadas 2P+T de 10A para parede")).toEqual(["tomada", "2p+t", "10a", "parede"]);
  });
});

describe("gerarConsultas", () => {
  it("sem resposta da IA, usa as palavras da descrição", async () => {
    llm.mockResolvedValue(null);
    const r = await gerarConsultas([linha("Notebook Dell")]);
    expect(r).toEqual({ consultas: [[["notebook"], ["dell"]]], comIa: false });
  });

  it("com IA, soma as consultas dela às palavras, sem repetir", async () => {
    llm.mockResolvedValue({ linhas: [{ indice: 0, consultas: ["computador portátil", "notebook"] }] });
    const r = await gerarConsultas([linha("Notebook Dell")]);
    expect(r.comIa).toBe(true);
    expect(r.consultas[0]).toEqual([["computador", "portatil"], ["notebook"], ["dell"]]);
  });
});

describe("ranquear / escolherPorPalavras", () => {
  const candidatos = [
    candidato("a", "Tomada 2P+T 10A Tramontina"),
    candidato("b", "Tomada 20A"),
    candidato("c", "Cabo flexível 2,5mm"),
  ];

  it("ordena pelo que casa mais e descarta o que não casa nada", () => {
    const r = ranquear(candidatos, [["tomada"], ["10a"]], linha("Tomada 10A"));
    expect(r.map((x) => x.candidato.id)).toEqual(["a", "b"]);
  });

  it("sem IA, só itens com pelo menos metade das palavras, como 'similar'", () => {
    const e = escolherPorPalavras(candidatos, [["tomada"], ["2p+t"], ["10a"]], linha("Tomada 2P+T 10A"));
    expect(e.map((x) => [x.itemId, x.aderencia])).toEqual([["a", "similar"]]);
  });
});

describe("julgarCandidatos", () => {
  const candidatos = [[candidato("a", "Tomada 10A"), candidato("b", "Tomada 20A")]];

  it("traduz as refs para ids e descarta refs inventadas ou repetidas", async () => {
    llm.mockResolvedValue({
      linhas: [
        {
          indice: 0,
          itens: [
            { ref: "c2", aderencia: "similar", justificativa: "Corrente maior" },
            { ref: "c9", aderencia: "exata", justificativa: "não existe" },
            { ref: "c2", aderencia: "exata", justificativa: "repetida" },
          ],
        },
      ],
    });
    const r = await julgarCandidatos([linha("Tomada 10A")], candidatos, [[["tomada"]]]);
    expect(r).toEqual({ escolhas: [[{ itemId: "b", aderencia: "similar", justificativa: "Corrente maior" }]], comIa: true });
  });

  it("resposta inválida cai na escolha por palavras", async () => {
    llm.mockResolvedValue({ qualquer: "coisa" });
    const r = await julgarCandidatos([linha("Tomada 10A")], candidatos, [[["tomada"], ["10a"]]]);
    expect(r.comIa).toBe(false);
    expect(r.escolhas[0].map((e) => e.itemId)).toEqual(["a", "b"]);
  });

  it("sem candidatos não chama a IA", async () => {
    const r = await julgarCandidatos([linha("Tomada")], [[]], [[["tomada"]]]);
    expect(llm).not.toHaveBeenCalled();
    expect(r.escolhas).toEqual([[]]);
  });
});

describe("alocarQuantidades", () => {
  const escolha = (itemId: string, aderencia: "exata" | "similar") => ({ itemId, aderencia, justificativa: "" });

  it("exatas primeiro, até a quantidade pedida, e o resto falta comprar", () => {
    const saldo = new Map([
      ["s", 10],
      ["e1", 1],
      ["e2", 1],
    ]);
    const r = alocarQuantidades(3, [escolha("s", "similar"), escolha("e1", "exata"), escolha("e2", "exata")], saldo);
    expect(r.alocacoes.map((a) => [a.itemId, a.quantidade])).toEqual([
      ["e1", 1],
      ["e2", 1],
      ["s", 1],
    ]);
    expect(r.faltante).toBe(0);
    expect(saldo.get("s")).toBe(9);
  });

  it("o saldo é compartilhado: o mesmo item não é prometido duas vezes", () => {
    const saldo = new Map([["x", 2]]);
    expect(alocarQuantidades(2, [escolha("x", "exata")], saldo).faltante).toBe(0);
    const segunda = alocarQuantidades(2, [escolha("x", "exata")], saldo);
    expect(segunda).toEqual({ alocacoes: [], alternativas: [escolha("x", "exata")], faltante: 2 });
  });

  it("o mesmo item em outras UTs, além do que já cobre a quantidade, volta como alternativa", () => {
    const saldo = new Map([
      ["utA", 5],
      ["utB", 3],
      ["utC", 1],
    ]);
    const r = alocarQuantidades(2, [escolha("utA", "exata"), escolha("utB", "exata"), escolha("utC", "similar")], saldo);
    expect(r.alocacoes.map((a) => [a.itemId, a.quantidade])).toEqual([["utA", 2]]);
    expect(r.alternativas.map((a) => a.itemId)).toEqual(["utB", "utC"]);
    expect(r.faltante).toBe(0);
  });
});
