import { describe, expect, it } from "vitest";

import { ehPapel, montarUsuarioLogado } from "@/lib/usuario-logado";

const base = { id: "u1", name: "Maria Souza", email: "maria@manserv.com.br" };

describe("ehPapel", () => {
  it("aceita só os três papéis do SPEC §2", () => {
    expect(ehPapel("colaborador")).toBe(true);
    expect(ehPapel("almoxarife")).toBe(true);
    expect(ehPapel("admin")).toBe(true);
    expect(ehPapel("gestor")).toBe(false);
    expect(ehPapel(undefined)).toBe(false);
  });
});

describe("montarUsuarioLogado", () => {
  it("converte o usuário da sessão e não carrega o CPF", () => {
    const usuario = montarUsuarioLogado({
      ...base,
      cpf: "52998224725",
      papel: "almoxarife",
      utId: "ut1",
      ativo: true,
      deveTrocarSenha: false,
    } as Parameters<typeof montarUsuarioLogado>[0]);

    expect(usuario).toEqual({
      id: "u1",
      nome: "Maria Souza",
      email: "maria@manserv.com.br",
      papel: "almoxarife",
      utId: "ut1",
      utsAdicionais: [],
      ativo: true,
      deveTrocarSenha: false,
    });
    expect(usuario).not.toHaveProperty("cpf");
  });

  it("admin pode não ter UT", () => {
    const usuario = montarUsuarioLogado({ ...base, papel: "admin", ativo: true, deveTrocarSenha: false });
    expect(usuario?.utId).toBeNull();
  });

  it("devolve null quando o papel é desconhecido", () => {
    expect(montarUsuarioLogado({ ...base, papel: "gestor", ativo: true })).toBeNull();
    expect(montarUsuarioLogado({ ...base, ativo: true })).toBeNull();
  });

  it("assume o valor mais restritivo quando faltam ativo e deveTrocarSenha", () => {
    const usuario = montarUsuarioLogado({ ...base, papel: "colaborador", utId: "ut1" });
    expect(usuario?.ativo).toBe(false);
    expect(usuario?.deveTrocarSenha).toBe(true);
  });
});
