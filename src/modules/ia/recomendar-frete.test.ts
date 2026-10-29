import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infra/llm", () => ({ completarJson: vi.fn(), iaDisponivel: vi.fn(() => true) }));

import { completarJson } from "@/infra/llm";

import { recomendarFrete, recomendarMenorCusto, type PedidoRecomendacaoFrete } from "./recomendar-frete";

const llm = vi.mocked(completarJson);
const cotacoes = [
  { id: 1, transportadora: "Correios", servico: "PAC", valor: 120, prazoDias: 8 },
  { id: 2, transportadora: "Correios", servico: "Sedex", valor: 120, prazoDias: 3 },
];
const pedido: PedidoRecomendacaoFrete = {
  origem: "Uberaba/MG",
  destino: "Campinas/SP",
  item: { nome: "Furadeira", marca: "Bosch", modelo: "GSB", categoria: "Material" },
  quantidade: 2,
  unidade: "un",
  carga: { pesoTotalKg: 4.2, volumeTotalM3: 0.015, maiorDimensaoCm: 30 },
  cotacoes,
  compraNova: 901.8,
};

beforeEach(() => {
  llm.mockReset();
});

describe("recomendarFrete", () => {
  it("aceita somente uma opção recebida e mantém as cotações fora da geração da IA", async () => {
    llm.mockResolvedValue({
      distanciaKm: 480.4,
      veiculoProprio: { min: 900, max: 1000 },
      recomendada: "frete_2",
      justificativa: " Mesmo preço e entrega mais rápida. ",
    });

    await expect(recomendarFrete(pedido)).resolves.toEqual({
      distanciaKm: 480,
      veiculoProprio: { min: 900, max: 1000 },
      recomendacao: {
        tipo: "cotacao",
        cotacaoId: 2,
        origem: "ia",
        justificativa: "Mesmo preço e entrega mais rápida.",
      },
    });
    const enviado = JSON.parse(llm.mock.calls[0][0].usuario);
    expect(enviado.cotacoes[1]).toMatchObject({ referencia: "frete_2", valor: 120, prazoDias: 3 });
  });

  it("rejeita ID inventado, resposta inválida ou falha do provedor", async () => {
    llm.mockResolvedValue({
      distanciaKm: 480,
      veiculoProprio: { min: 900, max: 1000 },
      recomendada: "frete_999",
      justificativa: "Inventado.",
    });
    await expect(recomendarFrete(pedido)).resolves.toBeNull();

    llm.mockResolvedValue(null);
    await expect(recomendarFrete(pedido)).resolves.toBeNull();
  });
});

describe("recomendarMenorCusto", () => {
  it("no mesmo preço entre fretes, escolhe o menor prazo", () => {
    expect(recomendarMenorCusto(cotacoes, 901.8)).toMatchObject({ tipo: "cotacao", cotacaoId: 2 });
  });

  it("no empate com a compra, transferir vence", () => {
    expect(recomendarMenorCusto([{ ...cotacoes[0], valor: 500 }], 500)).toMatchObject({ tipo: "cotacao" });
  });

  it("sem cotação mais barata, recomenda comprar novo", () => {
    expect(recomendarMenorCusto(cotacoes, 100)).toMatchObject({ tipo: "compra", origem: "menor_custo" });
    expect(recomendarMenorCusto([], 100)).toMatchObject({ tipo: "compra" });
  });
});
