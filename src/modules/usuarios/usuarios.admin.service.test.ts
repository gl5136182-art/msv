import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("@/infra/auth", () => ({
  gerarHashDeSenha: vi.fn(),
  gerarIdDeAuth: vi.fn(),
  entrarComEmailESenha: vi.fn(),
  trocarSenhaDaSessao: vi.fn(),
  encerrarSessaoDaRequisicao: vi.fn(),
}));
vi.mock("@/infra/db", () => ({ db: { $transaction: vi.fn() } }));
vi.mock("@/lib/senha", () => ({ gerarSenha: vi.fn() }));
vi.mock("@/modules/uts/uts.service", () => ({ exigirUtAtiva: vi.fn() }));
vi.mock("./usuarios.repository", () => ({
  listar: vi.fn(),
  buscarPorId: vi.fn(),
  existeComEmail: vi.fn(),
  existeComCpf: vi.fn(),
  criar: vi.fn(),
  criarContaDeSenha: vi.fn(),
  trocarHashDaSenha: vi.fn(),
  definirDeveTrocarSenha: vi.fn(),
  atualizarPerfil: vi.fn(),
  definirAtivo: vi.fn(),
  revogarSessoes: vi.fn(),
}));

import { gerarHashDeSenha, gerarIdDeAuth } from "@/infra/auth";
import { db } from "@/infra/db";
import { gerarSenha } from "@/lib/senha";
import { exigirUtAtiva } from "@/modules/uts/uts.service";

import * as repository from "./usuarios.repository";
import type { UsuarioRegistro } from "./usuarios.repository";
import type { CriarUsuarioEntrada } from "./usuarios.schemas";
import {
  alterarStatusUsuario,
  criarUsuario,
  editarUsuario,
  listarUsuarios,
  redefinirSenha,
} from "./usuarios.service";

const repo = vi.mocked(repository);
const TX = Symbol("transacao");
// Hash falso: não pode conter a senha em texto, senão o teste de vazamento não prova nada.
const HASH_DA_SENHA = "$scrypt$hash-opaco";

const admin: UsuarioLogado = {
  id: "adm",
  nome: "Admin",
  email: "admin@manserv.com.br",
  papel: "admin",
  utId: null,
  ativo: true,
  deveTrocarSenha: false,
};
const almoxarife: UsuarioLogado = { ...admin, id: "alm", papel: "almoxarife", utId: "ut1" };

function registro(parcial: Partial<UsuarioRegistro> = {}): UsuarioRegistro {
  return {
    id: "u1",
    name: "Maria Souza",
    email: "maria@manserv.com.br",
    cpf: "52998224725",
    telefone: null,
    papel: "almoxarife",
    utId: "ut1",
    ativo: true,
    deveTrocarSenha: true,
    createdAt: new Date("2026-02-01T10:00:00Z"),
    ut: { nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" },
    ...parcial,
  };
}

const entradaCriar: CriarUsuarioEntrada = {
  nome: "Maria Souza",
  email: "maria@manserv.com.br",
  cpf: "52998224725",
  telefone: null,
  papel: "almoxarife",
  utId: "ut1",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => fn(TX)) as never);
  vi.mocked(gerarSenha).mockReturnValue("Senha#Gerada1");
  vi.mocked(gerarHashDeSenha).mockResolvedValue(HASH_DA_SENHA);
  vi.mocked(gerarIdDeAuth).mockReturnValueOnce("id-usuario").mockReturnValue("id-conta");
  repo.existeComEmail.mockResolvedValue(false);
  repo.existeComCpf.mockResolvedValue(false);
});

describe("permissões: só admin administra usuários", () => {
  it.each([
    ["listarUsuarios", (u: UsuarioLogado) => listarUsuarios(u)],
    ["criarUsuario", (u: UsuarioLogado) => criarUsuario(u, entradaCriar)],
    ["editarUsuario", (u: UsuarioLogado) => editarUsuario(u, { id: "u1", papel: "colaborador", utId: "ut1", telefone: null })],
    ["redefinirSenha", (u: UsuarioLogado) => redefinirSenha(u, "u1")],
    ["alterarStatusUsuario", (u: UsuarioLogado) => alterarStatusUsuario(u, { id: "u1", ativo: false })],
  ])("%s: almoxarife não pode", async (_nome, chamar) => {
    await expect(chamar(almoxarife)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });

  it("nada é gravado quando a permissão é negada", async () => {
    await criarUsuario(almoxarife, entradaCriar).catch(() => {});
    await redefinirSenha(almoxarife, "u1").catch(() => {});
    await alterarStatusUsuario(almoxarife, { id: "u1", ativo: false }).catch(() => {});
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(repo.revogarSessoes).not.toHaveBeenCalled();
  });
});

describe("criarUsuario", () => {
  beforeEach(() => {
    repo.buscarPorId.mockResolvedValue(registro());
  });

  it("cria usuário e conta de senha na mesma transação, com troca obrigatória e senha gerada", async () => {
    const resultado = await criarUsuario(admin, entradaCriar);

    expect(exigirUtAtiva).toHaveBeenCalledWith("ut1");
    expect(repo.criar).toHaveBeenCalledWith(
      {
        id: "id-usuario",
        name: "Maria Souza",
        email: "maria@manserv.com.br",
        cpf: "52998224725",
        telefone: null,
        papel: "almoxarife",
        utId: "ut1",
      },
      TX,
    );
    expect(repo.criarContaDeSenha).toHaveBeenCalledWith(
      { id: "id-conta", usuarioId: "id-usuario", hash: HASH_DA_SENHA },
      TX,
    );
    expect(resultado.senhaGerada).toBe("Senha#Gerada1");
    expect(resultado.usuario.cpf).toBe("529.982.247-25");
  });

  it("grava só o hash: a senha em texto nunca vai ao repository", async () => {
    await criarUsuario(admin, entradaCriar);

    const chamadas = JSON.stringify([
      repo.criar.mock.calls,
      repo.criarContaDeSenha.mock.calls,
      repo.trocarHashDaSenha.mock.calls,
    ]);
    expect(chamadas).not.toContain("Senha#Gerada1");
    expect(chamadas).toContain(HASH_DA_SENHA);
  });

  it("admin pode ficar sem UT (e nenhuma UT é consultada)", async () => {
    await criarUsuario(admin, { ...entradaCriar, papel: "admin", utId: null });

    expect(exigirUtAtiva).not.toHaveBeenCalled();
    expect(repo.criar).toHaveBeenCalledWith(expect.objectContaining({ papel: "admin", utId: null }), TX);
  });

  it("UT inativa ou inexistente: a validação da UT barra antes de gravar", async () => {
    vi.mocked(exigirUtAtiva).mockRejectedValue(
      Object.assign(new Error("Esta UT está inativa."), { codigo: "UT_INATIVA" }),
    );

    await expect(criarUsuario(admin, entradaCriar)).rejects.toMatchObject({ codigo: "UT_INATIVA" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("e-mail já cadastrado", async () => {
    repo.existeComEmail.mockResolvedValue(true);

    await expect(criarUsuario(admin, entradaCriar)).rejects.toMatchObject({
      codigo: "EMAIL_DUPLICADO",
      message: "Já existe um usuário com este e-mail.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("CPF já cadastrado", async () => {
    repo.existeComCpf.mockResolvedValue(true);

    await expect(criarUsuario(admin, entradaCriar)).rejects.toMatchObject({ codigo: "CPF_DUPLICADO" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("traduz a violação do índice único do CPF (corrida entre duas requisições)", async () => {
    repo.criar.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["cpf"] } }),
    );

    await expect(criarUsuario(admin, entradaCriar)).rejects.toMatchObject({ codigo: "CPF_DUPLICADO" });
  });

  it("traduz a violação do índice único do e-mail", async () => {
    repo.criar.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["email"] } }),
    );

    await expect(criarUsuario(admin, entradaCriar)).rejects.toMatchObject({ codigo: "EMAIL_DUPLICADO" });
  });
});

describe("editarUsuario", () => {
  it("altera papel, UT e telefone", async () => {
    repo.buscarPorId.mockResolvedValue(registro());

    await editarUsuario(admin, { id: "u1", papel: "colaborador", utId: "ut2", telefone: "(34) 99999-0000" });

    expect(exigirUtAtiva).toHaveBeenCalledWith("ut2");
    expect(repo.atualizarPerfil).toHaveBeenCalledWith("u1", {
      papel: "colaborador",
      utId: "ut2",
      telefone: "(34) 99999-0000",
    });
  });

  it("não revalida a UT quando ela não mudou (pode ter sido desativada depois)", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ utId: "ut1" }));

    await editarUsuario(admin, { id: "u1", papel: "colaborador", utId: "ut1", telefone: null });

    expect(exigirUtAtiva).not.toHaveBeenCalled();
    expect(repo.atualizarPerfil).toHaveBeenCalled();
  });

  it("usuário inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);

    await expect(
      editarUsuario(admin, { id: "x", papel: "colaborador", utId: "ut1", telefone: null }),
    ).rejects.toMatchObject({ codigo: "USUARIO_NAO_ENCONTRADO" });
  });
});

describe("redefinirSenha", () => {
  it("troca o hash, exige nova troca e revoga as sessões, tudo na mesma transação", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ deveTrocarSenha: false }));

    const resultado = await redefinirSenha(admin, "u1");

    expect(repo.trocarHashDaSenha).toHaveBeenCalledWith("u1", HASH_DA_SENHA, TX);
    expect(repo.definirDeveTrocarSenha).toHaveBeenCalledWith("u1", true, TX);
    expect(repo.revogarSessoes).toHaveBeenCalledWith("u1", TX);
    expect(resultado.senhaGerada).toBe("Senha#Gerada1");
  });

  it("usuário inexistente: não gera senha nem grava", async () => {
    repo.buscarPorId.mockResolvedValue(null);

    await expect(redefinirSenha(admin, "x")).rejects.toMatchObject({ codigo: "USUARIO_NAO_ENCONTRADO" });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("alterarStatusUsuario", () => {
  beforeEach(() => {
    repo.buscarPorId.mockResolvedValue(registro());
  });

  it("desativar revoga as sessões do usuário", async () => {
    await alterarStatusUsuario(admin, { id: "u1", ativo: false });

    expect(repo.definirAtivo).toHaveBeenCalledWith("u1", false, TX);
    expect(repo.revogarSessoes).toHaveBeenCalledWith("u1", TX);
  });

  it("reativar não mexe nas sessões", async () => {
    await alterarStatusUsuario(admin, { id: "u1", ativo: true });

    expect(repo.definirAtivo).toHaveBeenCalledWith("u1", true, TX);
    expect(repo.revogarSessoes).not.toHaveBeenCalled();
  });

  it("o admin não desativa a si mesmo", async () => {
    await expect(alterarStatusUsuario(admin, { id: "adm", ativo: false })).rejects.toMatchObject({
      codigo: "AUTO_DESATIVACAO",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("listarUsuarios", () => {
  beforeEach(() => {
    repo.listar.mockResolvedValue([
      registro(),
      registro({
        id: "u2",
        name: "José Antônio",
        email: "jose@manserv.com.br",
        cpf: "11144477735",
        papel: "colaborador",
        ut: { nome: "YARA FERTILIZANTES CUB1", cidade: "Cubatão", uf: "SP" },
      }),
      registro({ id: "u3", name: "Administrador", email: "admin@manserv.com.br", cpf: "00000000604", papel: "admin", utId: null, ut: null }),
    ]);
  });

  it("devolve todos, com CPF formatado e rótulo da UT", async () => {
    const lista = await listarUsuarios(admin);
    expect(lista).toHaveLength(3);
    expect(lista[0].cpf).toBe("529.982.247-25");
    expect(lista[0].utRotulo).toBe("BASE OPERACIONAL PARADAS · Uberaba/MG");
    expect(lista[2].utRotulo).toBeNull();
  });

  it("busca por nome sem acento", async () => {
    expect((await listarUsuarios(admin, { busca: "jose antonio" })).map((u) => u.id)).toEqual(["u2"]);
  });

  it("busca por e-mail e por UT", async () => {
    expect((await listarUsuarios(admin, { busca: "maria@" })).map((u) => u.id)).toEqual(["u1"]);
    expect((await listarUsuarios(admin, { busca: "cubatao" })).map((u) => u.id)).toEqual(["u2"]);
  });

  it("busca por CPF, com ou sem máscara", async () => {
    expect((await listarUsuarios(admin, { busca: "111.444.777-35" })).map((u) => u.id)).toEqual(["u2"]);
    expect((await listarUsuarios(admin, { busca: "52998224725" })).map((u) => u.id)).toEqual(["u1"]);
  });
});
