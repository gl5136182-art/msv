import { describe, expect, it } from "vitest";

import { ErroNegocio } from "@/lib/erro-negocio";
import { exigirPapel } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/usuario-logado";

const base: UsuarioLogado = {
  id: "u1",
  nome: "Maria",
  email: "maria@manserv.com.br",
  papel: "almoxarife",
  utId: "ut1",
  ativo: true,
  deveTrocarSenha: false,
};

describe("exigirPapel", () => {
  it("deixa passar quando o papel está na lista", () => {
    expect(() => exigirPapel(base, "almoxarife")).not.toThrow();
    expect(() => exigirPapel(base, "colaborador", "almoxarife")).not.toThrow();
  });

  it("nega papel fora da lista com SEM_PERMISSAO", () => {
    expect(() => exigirPapel({ ...base, papel: "colaborador" }, "admin")).toThrow(ErroNegocio);
    expect(() => exigirPapel({ ...base, papel: "colaborador" }, "admin")).toThrow(
      expect.objectContaining({ codigo: "SEM_PERMISSAO" }),
    );
  });

  it("nega usuário inativo mesmo com o papel certo", () => {
    expect(() => exigirPapel({ ...base, papel: "admin", ativo: false }, "admin")).toThrow(
      expect.objectContaining({ codigo: "USUARIO_INATIVO" }),
    );
  });
});
