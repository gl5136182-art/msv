import { describe, expect, it } from "vitest";

import { gerarSenha, TAMANHO_SENHA_GERADA } from "@/lib/senha";

describe("gerarSenha", () => {
  it("gera 10 caracteres por padrão", () => {
    expect(TAMANHO_SENHA_GERADA).toBe(10);
    expect(gerarSenha()).toHaveLength(10);
  });

  it("respeita o tamanho pedido", () => {
    expect(gerarSenha(16)).toHaveLength(16);
  });

  it("nunca usa 0, O, 1, l nem I, e só letras e dígitos", () => {
    for (let i = 0; i < 2000; i++) {
      const senha = gerarSenha();
      expect(senha).toMatch(/^[A-Za-z2-9]+$/);
      expect(senha).not.toMatch(/[0O1lI]/);
    }
  });

  it("sempre tem maiúscula, minúscula e dígito", () => {
    for (let i = 0; i < 2000; i++) {
      const senha = gerarSenha();
      expect(senha).toMatch(/[A-Z]/);
      expect(senha).toMatch(/[a-z]/);
      expect(senha).toMatch(/[2-9]/);
    }
  });

  it("é aleatória: não repete e usa todo o alfabeto", () => {
    const senhas = new Set<string>();
    const usados = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const senha = gerarSenha();
      senhas.add(senha);
      for (const c of senha) usados.add(c);
    }
    expect(senhas.size).toBe(3000);
    // 24 maiúsculas + 25 minúsculas + 8 dígitos
    expect(usados.size).toBe(57);
  });

  it("recusa tamanhos inválidos", () => {
    expect(() => gerarSenha(2)).toThrow(RangeError);
    expect(() => gerarSenha(10.5)).toThrow(RangeError);
  });
});
