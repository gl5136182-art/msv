import { describe, expect, it } from "vitest";

import { decidirAcesso } from "@/lib/acesso";

const logado = { deveTrocarSenha: false };
const trocaPendente = { deveTrocarSenha: true };

describe("decidirAcesso: sem sessão", () => {
  it("manda qualquer rota para /login", () => {
    for (const caminho of ["/", "/vitrine", "/meus-itens", "/administracao", "/trocar-senha"]) {
      expect(decidirAcesso({ caminho, usuario: null })).toEqual({ acao: "redirecionar", para: "/login" });
    }
  });

  it("libera /login", () => {
    expect(decidirAcesso({ caminho: "/login", usuario: null })).toEqual({ acao: "liberar" });
    expect(decidirAcesso({ caminho: "/login/", usuario: null })).toEqual({ acao: "liberar" });
  });
});

describe("decidirAcesso: logado", () => {
  it("libera as rotas do app", () => {
    expect(decidirAcesso({ caminho: "/vitrine", usuario: logado })).toEqual({ acao: "liberar" });
    expect(decidirAcesso({ caminho: "/", usuario: logado })).toEqual({ acao: "liberar" });
  });

  it("libera /trocar-senha (troca voluntária pelo menu do avatar)", () => {
    expect(decidirAcesso({ caminho: "/trocar-senha", usuario: logado })).toEqual({ acao: "liberar" });
  });

  it("tira o usuário de /login", () => {
    expect(decidirAcesso({ caminho: "/login", usuario: logado })).toEqual({ acao: "redirecionar", para: "/" });
  });
});

describe("decidirAcesso: troca de senha obrigatória", () => {
  it("manda qualquer rota do app para /trocar-senha", () => {
    for (const caminho of ["/", "/vitrine", "/solicitacoes", "/administracao/usuarios"]) {
      expect(decidirAcesso({ caminho, usuario: trocaPendente })).toEqual({
        acao: "redirecionar",
        para: "/trocar-senha",
      });
    }
  });

  it("libera só /trocar-senha", () => {
    expect(decidirAcesso({ caminho: "/trocar-senha", usuario: trocaPendente })).toEqual({ acao: "liberar" });
  });

  it("de /login também vai para /trocar-senha", () => {
    expect(decidirAcesso({ caminho: "/login", usuario: trocaPendente })).toEqual({
      acao: "redirecionar",
      para: "/trocar-senha",
    });
  });
});
