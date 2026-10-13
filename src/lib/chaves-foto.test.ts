import { describe, expect, it } from "vitest";

import { chaveFotoValida, gerarChavesFoto } from "./chaves-foto";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("gerarChavesFoto", () => {
  it("monta as chaves no formato do CLAUDE.md, com ano e mês em UTC", () => {
    const r = gerarChavesFoto(new Date("2026-03-09T12:00:00Z"), UUID);
    expect(r.chave).toBe(`fotos/2026/03/${UUID}.jpg`);
    expect(r.chaveThumb).toBe(`fotos/2026/03/${UUID}_thumb.jpg`);
  });

  it("usa UTC na virada do mês", () => {
    const r = gerarChavesFoto(new Date("2026-04-01T00:30:00Z"), UUID);
    expect(r.chave.startsWith("fotos/2026/04/")).toBe(true);
  });

  it("gera uuids diferentes a cada chamada", () => {
    expect(gerarChavesFoto().chave).not.toBe(gerarChavesFoto().chave);
  });
});

describe("chaveFotoValida", () => {
  it("aceita as chaves geradas", () => {
    const r = gerarChavesFoto();
    expect(chaveFotoValida(r.chave)).toBe(true);
    expect(chaveFotoValida(r.chaveThumb)).toBe(true);
  });

  it("recusa formatos fora do padrão", () => {
    expect(chaveFotoValida("../segredo.jpg")).toBe(false);
    expect(chaveFotoValida(`fotos/2026/03/${UUID}.png`)).toBe(false);
    expect(chaveFotoValida(`outra/2026/03/${UUID}.jpg`)).toBe(false);
  });
});
