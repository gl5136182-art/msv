import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infra/llm", () => ({ completarJson: vi.fn(), iaDisponivel: vi.fn(() => true) }));

import { completarJson } from "@/infra/llm";

import { compararOpcoes, consolidarCarga, estimarFrete, type MedidasDoItem, type PedidoFrete } from "./estimar-frete";

const llm = vi.mocked(completarJson);

const semMedidas: MedidasDoItem = {
  larguraCm: null,
  alturaCm: null,
  profundidadeCm: null,
  pesoKg: null,
  lote: null,
  quantidadeDisponivel: 10,
};

beforeEach(() => {
  llm.mockReset();
});

describe("consolidarCarga", () => {
  it("multiplica as medidas por unidade pela quantidade", () => {
    const carga = consolidarCarga(
      { ...semMedidas, larguraCm: 50, alturaCm: 40, profundidadeCm: 30, pesoKg: 2.5 },
      40,
    );
    expect(carga).toEqual({ medidasInformadas: true, pesoTotalKg: 100, volumeTotalM3: 2.4, maiorDimensaoCm: 50 });
  });

  it("só com o peso, o volume fica nulo", () => {
    const carga = consolidarCarga({ ...semMedidas, pesoKg: 3 }, 2);
    expect(carga).toEqual({ medidasInformadas: true, pesoTotalKg: 6, volumeTotalM3: null, maiorDimensaoCm: null });
  });

  it("sem medidas por unidade, rateia o lote pela fração pedida", () => {
    const carga = consolidarCarga(
      { ...semMedidas, lote: { larguraCm: 100, alturaCm: 100, profundidadeCm: 100, pesoKg: 200 } },
      5,
    );
    expect(carga).toEqual({ medidasInformadas: true, pesoTotalKg: 100, volumeTotalM3: 0.5, maiorDimensaoCm: 100 });
  });

  it("sem medidas nem lote, avisa que a IA vai estimar", () => {
    expect(consolidarCarga(semMedidas, 3)).toEqual({
      medidasInformadas: false,
      pesoTotalKg: null,
      volumeTotalM3: null,
      maiorDimensaoCm: null,
    });
  });
});

describe("compararOpcoes", () => {
  it("transferir sai mais barato que comprar 40 unidades novas", () => {
    const r = compararOpcoes(210, 40, {
      transportadora: { min: 80, max: 180 },
      veiculoProprio: { min: 900, max: 1000 },
    });
    expect(r).toEqual({ compraNova: 8400, recomendada: "transportadora" });
  });

  it("item barato: comprar novo vence", () => {
    const r = compararOpcoes(5, 2, { transportadora: { min: 60, max: 90 }, veiculoProprio: { min: 200, max: 300 } });
    expect(r.recomendada).toBe("compra");
  });

  it("veículo próprio vence quando a faixa média é menor", () => {
    const r = compararOpcoes(5000, 1, { transportadora: { min: 900, max: 1500 }, veiculoProprio: { min: 300, max: 500 } });
    expect(r.recomendada).toBe("veiculo");
  });
});

describe("estimarFrete", () => {
  const pedido: PedidoFrete = {
    origem: { cidade: "Campinas", uf: "SP" },
    destino: { cidade: "Belo Horizonte", uf: "MG" },
    item: { nome: "Cadeira", marca: "X", modelo: "Y", categoria: "Material" },
    quantidade: 40,
    unidade: "un",
    carga: { medidasInformadas: true, pesoTotalKg: 100, volumeTotalM3: 2.4, maiorDimensaoCm: 50 },
  };

  it("lê a resposta da IA e arredonda", async () => {
    llm.mockResolvedValue({
      distanciaKm: 585.4,
      transportadora: { min: 80, max: "180" },
      veiculoProprio: { min: 900, max: 1000 },
      justificativa: "  Carga fracionada.  ",
    });
    expect(await estimarFrete(pedido)).toEqual({
      distanciaKm: 585,
      transportadora: { min: 80, max: 180 },
      veiculoProprio: { min: 900, max: 1000 },
      justificativa: "Carga fracionada.",
    });
    const enviado = JSON.parse(llm.mock.calls[0][0].usuario);
    expect(enviado).toMatchObject({ origem: "Campinas/SP", destino: "Belo Horizonte/MG", quantidade: 40 });
  });

  it("faixa invertida ou resposta inválida → null", async () => {
    llm.mockResolvedValue({
      distanciaKm: 10,
      transportadora: { min: 200, max: 100 },
      veiculoProprio: { min: 1, max: 2 },
    });
    expect(await estimarFrete(pedido)).toBeNull();

    llm.mockResolvedValue(null);
    expect(await estimarFrete(pedido)).toBeNull();
  });
});
