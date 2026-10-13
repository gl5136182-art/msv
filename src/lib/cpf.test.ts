import { describe, expect, it } from "vitest";

import { aplicarMascaraCpf, cpfValido, formatarCpf, limparCpf, mascararCpf, pareceCpf } from "@/lib/cpf";

// CPFs de exemplo com dígitos verificadores corretos (não pertencem a pessoas reais).
const VALIDO = "52998224725";
const VALIDO_MASCARADO = "529.982.247-25";

describe("limparCpf", () => {
  it("remove tudo que não é dígito", () => {
    expect(limparCpf("529.982.247-25")).toBe(VALIDO);
    expect(limparCpf(" 529 982 247 25 ")).toBe(VALIDO);
    expect(limparCpf("")).toBe("");
  });
});

describe("cpfValido", () => {
  it("aceita CPF com e sem máscara", () => {
    expect(cpfValido(VALIDO)).toBe(true);
    expect(cpfValido(VALIDO_MASCARADO)).toBe(true);
    expect(cpfValido("111.444.777-35")).toBe(true);
  });

  it("aceita CPF cujo dígito verificador calculado é 10 (vira 0)", () => {
    // Base 000000006: soma 12 → (12 × 10) % 11 = 10, que vira 0 no 1º dígito.
    expect(cpfValido("00000000604")).toBe(true);
  });

  it("recusa dígito verificador errado", () => {
    expect(cpfValido("52998224726")).toBe(false);
    expect(cpfValido("52998224715")).toBe(false);
  });

  it("recusa tamanho diferente de 11 dígitos", () => {
    expect(cpfValido("")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("529982247250")).toBe(false);
  });

  it("recusa sequências de dígitos repetidos", () => {
    for (let d = 0; d <= 9; d++) {
      expect(cpfValido(String(d).repeat(11))).toBe(false);
    }
  });
});

describe("pareceCpf", () => {
  it("reconhece 11 dígitos, com ou sem pontuação", () => {
    expect(pareceCpf(VALIDO)).toBe(true);
    expect(pareceCpf(VALIDO_MASCARADO)).toBe(true);
    expect(pareceCpf("  529.982.247-25  ")).toBe(true);
  });

  it("não depende de o CPF ser válido (a validade é checada depois)", () => {
    expect(pareceCpf("11111111111")).toBe(true);
  });

  it("não confunde e-mail nem outros textos com CPF", () => {
    expect(pareceCpf("maria@manserv.com.br")).toBe(false);
    expect(pareceCpf("12345678901@manserv.com.br")).toBe(false);
    expect(pareceCpf("a52998224725")).toBe(false);
    expect(pareceCpf("5299822472")).toBe(false);
    expect(pareceCpf("")).toBe(false);
  });
});

describe("formatarCpf", () => {
  it("aplica a máscara", () => {
    expect(formatarCpf(VALIDO)).toBe(VALIDO_MASCARADO);
    expect(formatarCpf(VALIDO_MASCARADO)).toBe(VALIDO_MASCARADO);
  });

  it("devolve o texto como veio quando não tem 11 dígitos", () => {
    expect(formatarCpf("123")).toBe("123");
  });
});

describe("mascararCpf", () => {
  it("esconde os 3 primeiros e os 2 últimos dígitos (LGPD)", () => {
    expect(mascararCpf(VALIDO)).toBe("***.982.247-**");
    expect(mascararCpf(VALIDO_MASCARADO)).toBe("***.982.247-**");
  });

  it("devolve o texto como veio quando não tem 11 dígitos", () => {
    expect(mascararCpf("123")).toBe("123");
  });
});

describe("aplicarMascaraCpf (campo digitando)", () => {
  it("monta a máscara aos poucos", () => {
    expect(aplicarMascaraCpf("")).toBe("");
    expect(aplicarMascaraCpf("5")).toBe("5");
    expect(aplicarMascaraCpf("5299")).toBe("529.9");
    expect(aplicarMascaraCpf("529982")).toBe("529.982");
    expect(aplicarMascaraCpf("5299822")).toBe("529.982.2");
    expect(aplicarMascaraCpf("529982247")).toBe("529.982.247");
    expect(aplicarMascaraCpf("5299822472")).toBe("529.982.247-2");
    expect(aplicarMascaraCpf("52998224725")).toBe("529.982.247-25");
  });

  it("ignora o que não é dígito e corta em 11 dígitos", () => {
    expect(aplicarMascaraCpf("529.982.247-25")).toBe("529.982.247-25");
    expect(aplicarMascaraCpf("abc 529x982")).toBe("529.982");
    expect(aplicarMascaraCpf("529982247259999")).toBe("529.982.247-25");
  });
});
