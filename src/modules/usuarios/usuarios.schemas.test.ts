import { describe, expect, it } from "vitest";

import { criarUsuarioSchema, editarUsuarioSchema, trocarSenhaSchema } from "./usuarios.schemas";

function mensagens(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } }, entrada: unknown) {
  const r = schema.safeParse(entrada);
  return r.success ? [] : (r.error?.issues.map((i) => i.message) ?? []);
}

describe("trocarSenhaSchema", () => {
  it("aceita senha nova válida", () => {
    expect(
      trocarSenhaSchema.safeParse({ senhaAtual: "Antiga123", novaSenha: "Nova12345", confirmacao: "Nova12345" })
        .success,
    ).toBe(true);
  });

  it("exige no mínimo 8 caracteres", () => {
    expect(
      mensagens(trocarSenhaSchema, { senhaAtual: "Antiga123", novaSenha: "curta12", confirmacao: "curta12" }),
    ).toContain("A nova senha deve ter no mínimo 8 caracteres.");
    expect(
      trocarSenhaSchema.safeParse({ senhaAtual: "Antiga123", novaSenha: "oitoooo8", confirmacao: "oitoooo8" })
        .success,
    ).toBe(true);
  });

  it("exige senha diferente da atual", () => {
    expect(
      mensagens(trocarSenhaSchema, { senhaAtual: "Mesma1234", novaSenha: "Mesma1234", confirmacao: "Mesma1234" }),
    ).toContain("A nova senha deve ser diferente da atual.");
  });

  it("exige confirmação igual à nova senha", () => {
    expect(
      mensagens(trocarSenhaSchema, { senhaAtual: "Antiga123", novaSenha: "Nova12345", confirmacao: "Nova12346" }),
    ).toContain("As senhas não conferem.");
  });

  it("exige a senha atual", () => {
    expect(
      mensagens(trocarSenhaSchema, { senhaAtual: "", novaSenha: "Nova12345", confirmacao: "Nova12345" }),
    ).toContain("Informe a senha atual.");
  });
});

const valido = {
  nome: " Maria Souza ",
  email: " Maria@Manserv.com.br ",
  cpf: "529.982.247-25",
  telefone: "(34) 99999-0000",
  papel: "almoxarife",
  utId: "ut1",
};

describe("criarUsuarioSchema", () => {
  it("normaliza: apara, e-mail em minúsculas, CPF só com dígitos", () => {
    const r = criarUsuarioSchema.parse(valido);
    expect(r).toEqual({
      nome: "Maria Souza",
      email: "maria@manserv.com.br",
      cpf: "52998224725",
      telefone: "(34) 99999-0000",
      papel: "almoxarife",
      utId: "ut1",
      utsAdicionais: [],
    });
  });

  it("telefone vazio vira null e UT vazia vira null", () => {
    const r = criarUsuarioSchema.parse({ ...valido, telefone: " ", papel: "admin", utId: "" });
    expect(r.telefone).toBeNull();
    expect(r.utId).toBeNull();
  });

  it("recusa CPF com dígito verificador errado", () => {
    expect(mensagens(criarUsuarioSchema, { ...valido, cpf: "529.982.247-26" })).toContain("CPF inválido.");
  });

  it("recusa e-mail inválido", () => {
    expect(mensagens(criarUsuarioSchema, { ...valido, email: "maria@" })).toContain("Informe um e-mail válido.");
  });

  it("recusa papel desconhecido", () => {
    expect(mensagens(criarUsuarioSchema, { ...valido, papel: "gestor" })).toContain("Selecione o papel.");
  });

  it("UT é obrigatória para colaborador e almoxarife, mas não para admin", () => {
    const aviso = "Selecione a UT. Só o administrador pode ficar sem UT.";
    expect(mensagens(criarUsuarioSchema, { ...valido, papel: "colaborador", utId: "" })).toContain(aviso);
    expect(mensagens(criarUsuarioSchema, { ...valido, papel: "almoxarife", utId: "" })).toContain(aviso);
    expect(criarUsuarioSchema.safeParse({ ...valido, papel: "admin", utId: "" }).success).toBe(true);
  });

  it("recusa telefone com letras", () => {
    expect(mensagens(criarUsuarioSchema, { ...valido, telefone: "abc" })).toContain(
      "Use só números, espaços, parênteses e hífen no telefone.",
    );
  });
});

describe("editarUsuarioSchema", () => {
  it("mesma regra da UT", () => {
    const aviso = "Selecione a UT. Só o administrador pode ficar sem UT.";
    expect(mensagens(editarUsuarioSchema, { id: "u1", papel: "colaborador", utId: "", telefone: "" })).toContain(aviso);
    expect(editarUsuarioSchema.safeParse({ id: "u1", papel: "admin", utId: "", telefone: "" }).success).toBe(true);
  });
});
