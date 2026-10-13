import { describe, expect, it } from "vitest";

import { calcularAjusteDeQuantidade, statusAposArquivamento, statusAposMudarQuantidade } from "./itens.regras";

describe("statusAposMudarQuantidade (regra 3)", () => {
  it("chegar a 0 esgota o item", () => {
    expect(statusAposMudarQuantidade("disponivel", 0)).toBe("esgotado");
  });

  it("voltar a ter quantidade reativa o item esgotado", () => {
    expect(statusAposMudarQuantidade("esgotado", 4)).toBe("disponivel");
  });

  it("item disponível com quantidade positiva continua disponível", () => {
    expect(statusAposMudarQuantidade("disponivel", 1)).toBe("disponivel");
  });

  it("arquivado não muda por causa da quantidade (regra 4)", () => {
    expect(statusAposMudarQuantidade("arquivado", 0)).toBe("arquivado");
    expect(statusAposMudarQuantidade("arquivado", 5)).toBe("arquivado");
  });
});

describe("calcularAjusteDeQuantidade (regra 2)", () => {
  it("reduzir mantém o total e o status", () => {
    expect(calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "disponivel" }, 4)).toEqual({
      quantidadeDisponivel: 4,
      quantidadeTotal: 10,
      status: "disponivel",
    });
  });

  it("zerar esgota o item", () => {
    expect(calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "disponivel" }, 0)).toEqual({
      quantidadeDisponivel: 0,
      quantidadeTotal: 10,
      status: "esgotado",
    });
  });

  it("voltar de 0 para um valor positivo reativa o item", () => {
    expect(calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "esgotado" }, 3).status).toBe("disponivel");
  });

  it("passar do total cadastrado sobe o total junto", () => {
    expect(calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "disponivel" }, 15)).toEqual({
      quantidadeDisponivel: 15,
      quantidadeTotal: 15,
      status: "disponivel",
    });
  });

  it("igual ao total não altera o total", () => {
    expect(calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "disponivel" }, 10).quantidadeTotal).toBe(10);
  });

  it("item arquivado continua arquivado", () => {
    expect(calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "arquivado" }, 0).status).toBe("arquivado");
    expect(calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "arquivado" }, 7).status).toBe("arquivado");
  });

  it("nunca aceita quantidade negativa ou fracionada", () => {
    expect(() => calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "disponivel" }, -1)).toThrow(RangeError);
    expect(() => calcularAjusteDeQuantidade({ quantidadeTotal: 10, status: "disponivel" }, 1.5)).toThrow(RangeError);
  });
});

describe("statusAposArquivamento (regra 4)", () => {
  it("arquivar sempre arquiva", () => {
    expect(statusAposArquivamento(true, 5)).toBe("arquivado");
    expect(statusAposArquivamento(true, 0)).toBe("arquivado");
  });

  it("reativar volta a disponível quando há unidades", () => {
    expect(statusAposArquivamento(false, 5)).toBe("disponivel");
  });

  it("reativar item sem unidades deixa esgotado", () => {
    expect(statusAposArquivamento(false, 0)).toBe("esgotado");
  });
});
