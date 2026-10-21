import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

import type { UtEntrada } from "./uts.schemas";

vi.mock("@/infra/db", () => ({ db: { $transaction: vi.fn() } }));
vi.mock("@/modules/solicitacoes/solicitacoes.service", () => ({
  cancelarPendentesDaUtDesativada: vi.fn(async () => []),
  notificarCancelamentosDaUtDesativada: vi.fn(async () => undefined),
}));
vi.mock("./uts.repository", () => ({
  listar: vi.fn(),
  listarAtivas: vi.fn(),
  buscarPorId: vi.fn(),
  buscarPorCodigo: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  definirAtivo: vi.fn(),
}));

import { db } from "@/infra/db";
import { cancelarPendentesDaUtDesativada } from "@/modules/solicitacoes/solicitacoes.service";

import * as repository from "./uts.repository";
import type { UtRegistro } from "./uts.repository";
import {
  alterarStatusUt,
  criarUt,
  editarUt,
  listarUts,
  listarUtsAtivas,
  obterRotuloDaUt,
  obterUt,
} from "./uts.service";

const repo = vi.mocked(repository);

const admin: UsuarioLogado = {
  id: "adm",
  nome: "Admin",
  email: "admin@manserv.com.br",
  papel: "admin",
  utId: null,
  utsAdicionais: [],
  ativo: true,
  deveTrocarSenha: false,
};
const almoxarife: UsuarioLogado = { ...admin, id: "alm", papel: "almoxarife", utId: "ut1" };
const colaborador: UsuarioLogado = { ...admin, id: "col", papel: "colaborador", utId: "ut1" };

function ut(parcial: Partial<UtRegistro> = {}): UtRegistro {
  return {
    id: "ut1",
    codigo: "06.00.0171.256",
    nome: "BASE OPERACIONAL PARADAS",
    cidade: "Uberaba",
    uf: "MG",
    ativo: true,
    criadoEm: new Date("2026-01-10T12:00:00Z"),
    ...parcial,
  };
}

const entrada: UtEntrada = { codigo: "06.00.0171.256", nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" };

const TX = { tx: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => fn(TX)) as never);
});

describe("permissões: só admin administra UTs", () => {
  it.each([
    ["listarUts", (u: UsuarioLogado) => listarUts(u)],
    ["obterUt", (u: UsuarioLogado) => obterUt(u, "ut1")],
    ["criarUt", (u: UsuarioLogado) => criarUt(u, entrada)],
    ["editarUt", (u: UsuarioLogado) => editarUt(u, { ...entrada, id: "ut1" })],
    ["alterarStatusUt", (u: UsuarioLogado) => alterarStatusUt(u, { id: "ut1", ativo: false })],
  ])("%s: almoxarife e colaborador não podem", async (_nome, chamar) => {
    await expect(chamar(almoxarife)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(chamar(colaborador)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });

  it("admin inativo não pode", async () => {
    await expect(listarUts({ ...admin, ativo: false })).rejects.toMatchObject({ codigo: "USUARIO_INATIVO" });
  });

  it("nada é gravado quando a permissão é negada", async () => {
    await criarUt(colaborador, entrada).catch(() => {});
    await editarUt(colaborador, { ...entrada, id: "ut1" }).catch(() => {});
    await alterarStatusUt(colaborador, { id: "ut1", ativo: false }).catch(() => {});
    expect(repo.criar).not.toHaveBeenCalled();
    expect(repo.atualizar).not.toHaveBeenCalled();
    expect(repo.definirAtivo).not.toHaveBeenCalled();
  });
});

describe("listarUts", () => {
  beforeEach(() => {
    repo.listar.mockResolvedValue([
      ut(),
      ut({ id: "ut2", codigo: "9.04.0447.009", nome: "YARA FERTILIZANTES CUB1", cidade: "Cubatão", uf: "SP" }),
      ut({ id: "ut3", codigo: "DEMO-01", nome: "UT Demonstração 01", cidade: "Curitiba", uf: "PR", ativo: false }),
    ]);
  });

  it("devolve todas, inclusive inativas, com o rótulo Nome · Cidade/UF", async () => {
    const lista = await listarUts(admin);
    expect(lista).toHaveLength(3);
    expect(lista[0].rotulo).toBe("BASE OPERACIONAL PARADAS · Uberaba/MG");
    expect(lista[0].criadoEm).toBe("2026-01-10T12:00:00.000Z");
  });

  it("busca por cidade sem considerar acento nem caixa", async () => {
    const lista = await listarUts(admin, { busca: "CUBATAO" });
    expect(lista.map((u) => u.id)).toEqual(["ut2"]);
  });

  it("busca por código, nome e UF", async () => {
    expect((await listarUts(admin, { busca: "06.00.0171" })).map((u) => u.id)).toEqual(["ut1"]);
    expect((await listarUts(admin, { busca: "demonstracao" })).map((u) => u.id)).toEqual(["ut3"]);
    expect((await listarUts(admin, { busca: "sp" })).map((u) => u.id)).toEqual(["ut2"]);
  });

  it("busca sem resultado devolve lista vazia", async () => {
    expect(await listarUts(admin, { busca: "inexistente" })).toEqual([]);
  });
});

describe("listarUtsAtivas", () => {
  it("qualquer usuário logado e ativo pode listar as ativas (selects)", async () => {
    repo.listarAtivas.mockResolvedValue([ut()]);
    await expect(listarUtsAtivas(colaborador)).resolves.toHaveLength(1);
  });
});

describe("criarUt", () => {
  it("grava os dados informados e devolve o DTO", async () => {
    repo.buscarPorCodigo.mockResolvedValue(null);
    repo.criar.mockResolvedValue(ut());

    const criada = await criarUt(admin, entrada);

    expect(repo.criar).toHaveBeenCalledWith(entrada);
    expect(criada.rotulo).toBe("BASE OPERACIONAL PARADAS · Uberaba/MG");
  });

  it("recusa código já usado, sem gravar", async () => {
    repo.buscarPorCodigo.mockResolvedValue(ut());

    await expect(criarUt(admin, entrada)).rejects.toMatchObject({
      codigo: "CODIGO_DUPLICADO",
      message: "Já existe uma UT com este código.",
    });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("traduz a violação do índice único (corrida entre duas requisições)", async () => {
    repo.buscarPorCodigo.mockResolvedValue(null);
    repo.criar.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

    await expect(criarUt(admin, entrada)).rejects.toMatchObject({ codigo: "CODIGO_DUPLICADO" });
  });

  it("repassa erros inesperados do banco sem traduzir", async () => {
    repo.buscarPorCodigo.mockResolvedValue(null);
    repo.criar.mockRejectedValue(new Error("conexão perdida"));

    await expect(criarUt(admin, entrada)).rejects.toThrow("conexão perdida");
  });
});

describe("editarUt", () => {
  it("edita mantendo o próprio código", async () => {
    repo.buscarPorId.mockResolvedValue(ut());
    repo.buscarPorCodigo.mockResolvedValue(ut());
    repo.atualizar.mockResolvedValue(ut({ cidade: "Araxá" }));

    const editada = await editarUt(admin, { ...entrada, id: "ut1", cidade: "Araxá" });

    expect(repo.atualizar).toHaveBeenCalledWith("ut1", { ...entrada, cidade: "Araxá" });
    expect(editada.cidade).toBe("Araxá");
  });

  it("recusa trocar para o código de outra UT", async () => {
    repo.buscarPorId.mockResolvedValue(ut());
    repo.buscarPorCodigo.mockResolvedValue(ut({ id: "ut2" }));

    await expect(editarUt(admin, { ...entrada, id: "ut1" })).rejects.toMatchObject({
      codigo: "CODIGO_DUPLICADO",
    });
    expect(repo.atualizar).not.toHaveBeenCalled();
  });

  it("UT inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(editarUt(admin, { ...entrada, id: "x" })).rejects.toMatchObject({ codigo: "UT_NAO_ENCONTRADA" });
  });
});

describe("alterarStatusUt", () => {
  it("desativa e reativa", async () => {
    repo.buscarPorId.mockResolvedValue(ut());
    repo.definirAtivo.mockResolvedValue(ut({ ativo: false }));

    const desativada = await alterarStatusUt(admin, { id: "ut1", ativo: false });

    expect(repo.definirAtivo).toHaveBeenCalledWith("ut1", false, TX);
    expect(desativada.ativo).toBe(false);
  });

  it("desativar cancela as solicitações pendentes da UT na mesma transação (regra 13)", async () => {
    repo.buscarPorId.mockResolvedValue(ut());
    repo.definirAtivo.mockResolvedValue(ut({ ativo: false }));

    await alterarStatusUt(admin, { id: "ut1", ativo: false });

    expect(cancelarPendentesDaUtDesativada).toHaveBeenCalledWith("ut1", TX);
  });

  it("reativar não cancela nada", async () => {
    repo.buscarPorId.mockResolvedValue(ut({ ativo: false }));
    repo.definirAtivo.mockResolvedValue(ut());

    await alterarStatusUt(admin, { id: "ut1", ativo: true });

    expect(cancelarPendentesDaUtDesativada).not.toHaveBeenCalled();
  });

  it("UT inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(alterarStatusUt(admin, { id: "x", ativo: true })).rejects.toMatchObject({
      codigo: "UT_NAO_ENCONTRADA",
    });
  });
});

describe("obterRotuloDaUt", () => {
  it("null sem UT (admin) e para UT inexistente", async () => {
    expect(await obterRotuloDaUt(null)).toBeNull();
    repo.buscarPorId.mockResolvedValue(null);
    expect(await obterRotuloDaUt("x")).toBeNull();
  });

  it('monta "Nome · Cidade/UF"', async () => {
    repo.buscarPorId.mockResolvedValue(ut());
    expect(await obterRotuloDaUt("ut1")).toBe("BASE OPERACIONAL PARADAS · Uberaba/MG");
  });
});
