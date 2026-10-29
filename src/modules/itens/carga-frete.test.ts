import { describe, expect, it } from "vitest";

import { prepararCargaFrete, type MedidasDoItem } from "./carga-frete";

const semMedidas: MedidasDoItem = {
  larguraCm: null,
  alturaCm: null,
  profundidadeCm: null,
  pesoKg: null,
  lote: null,
  quantidadeDisponivel: 10,
};

describe("prepararCargaFrete", () => {
  it("envia produtos com quantidade e calcula os totais", () => {
    const carga = prepararCargaFrete(
      { ...semMedidas, larguraCm: 50, alturaCm: 40, profundidadeCm: 30, pesoKg: 2.5 },
      40,
    );

    expect(carga).toEqual({
      pesoTotalKg: 100,
      volumeTotalM3: 2.4,
      maiorDimensaoCm: 50,
      pacote: { products: [{ quantity: 40, weight: 2.5, height: 40, width: 50, length: 30 }] },
    });
  });

  it("sem medidas por unidade, permite o lote inteiro como um único volume", () => {
    const lote = { larguraCm: 100, alturaCm: 80, profundidadeCm: 60, pesoKg: 200 };
    const carga = prepararCargaFrete({ ...semMedidas, lote }, 10);

    expect(carga.pacote).toEqual({ package: { weight: 200, height: 80, width: 100, length: 60 } });
    expect(carga.volumeTotalM3).toBe(0.48);
  });

  it("recusa lote parcial sem medidas por unidade", () => {
    const lote = { larguraCm: 100, alturaCm: 80, profundidadeCm: 60, pesoKg: 200 };
    expect(() => prepararCargaFrete({ ...semMedidas, lote }, 5)).toThrowError(
      expect.objectContaining({ codigo: "MEDIDAS_INSUFICIENTES" }),
    );
  });

  it("recusa medidas ausentes ou incompletas", () => {
    expect(() => prepararCargaFrete(semMedidas, 1)).toThrowError(
      expect.objectContaining({ codigo: "MEDIDAS_INSUFICIENTES" }),
    );
    expect(() => prepararCargaFrete({ ...semMedidas, pesoKg: 3 }, 1)).toThrowError(
      expect.objectContaining({ codigo: "MEDIDAS_INSUFICIENTES" }),
    );
  });
});
