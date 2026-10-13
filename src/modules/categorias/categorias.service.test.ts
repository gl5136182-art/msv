import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("./categorias.repository", () => ({
  listar: vi.fn(),
  listarAtivas: vi.fn(),
  buscarPorId: vi.fn(),
  criar: vi.fn(),
  renomear: vi.fn(),
  definirAtivo: vi.fn(),
}));

import * as repository from "./categorias.repository";
import { categoriaSchema } from "./categorias.schemas";
import {
  alterarStatusCategoria,
  criarCategoria,
  listarCategorias,
  listarCategoriasAtivas,
  renomearCategoria,
} from "./categorias.service";

const repo = vi.mocked(repository);

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

const epi = { id: "c1", nome: "EPI", ativo: true };
const eletrica = { id: "c2", nome: "Elétrica", ativo: true };

beforeEach(() => {
  vi.resetAllMocks();
  repo.listar.mockResolvedValue([epi, eletrica]);
});

describe("permissões", () => {
  it.each([
    ["listarCategorias", (u: UsuarioLogado) => listarCategorias(u)],
    ["criarCategoria", (u: UsuarioLogado) => criarCategoria(u, { nome: "Nova" })],
    ["renomearCategoria", (u: UsuarioLogado) => renomearCategoria(u, { id: "c1", nome: "Outra" })],
    ["alterarStatusCategoria", (u: UsuarioLogado) => alterarStatusCategoria(u, { id: "c1", ativo: false })],
  ])("%s: só admin", async (_nome, chamar) => {
    await expect(chamar(almoxarife)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.criar).not.toHaveBeenCalled();
    expect(repo.renomear).not.toHaveBeenCalled();
    expect(repo.definirAtivo).not.toHaveBeenCalled();
  });

  it("qualquer usuário logado lê as categorias ativas", async () => {
    repo.listarAtivas.mockResolvedValue([epi]);
    await expect(listarCategoriasAtivas(almoxarife)).resolves.toEqual([epi]);
  });
});

describe("criarCategoria", () => {
  it("cria com o nome informado", async () => {
    repo.criar.mockResolvedValue({ id: "c3", nome: "Segurança", ativo: true });

    const criada = await criarCategoria(admin, { nome: "Segurança" });

    expect(repo.criar).toHaveBeenCalledWith("Segurança");
    expect(criada).toEqual({ id: "c3", nome: "Segurança", ativo: true });
  });

  it("recusa nome repetido sem considerar caixa nem acento", async () => {
    await expect(criarCategoria(admin, { nome: "eletrica" })).rejects.toMatchObject({
      codigo: "NOME_DUPLICADO",
      message: "Já existe uma categoria com este nome.",
    });
    await expect(criarCategoria(admin, { nome: "epi" })).rejects.toMatchObject({ codigo: "NOME_DUPLICADO" });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("traduz a violação do índice único do banco", async () => {
    repo.criar.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
    await expect(criarCategoria(admin, { nome: "Segurança" })).rejects.toMatchObject({ codigo: "NOME_DUPLICADO" });
  });
});

describe("renomearCategoria", () => {
  it("renomeia", async () => {
    repo.buscarPorId.mockResolvedValue(epi);
    repo.renomear.mockResolvedValue({ ...epi, nome: "EPIs" });

    const renomeada = await renomearCategoria(admin, { id: "c1", nome: "EPIs" });

    expect(repo.renomear).toHaveBeenCalledWith("c1", "EPIs");
    expect(renomeada.nome).toBe("EPIs");
  });

  it("trocar só a caixa do próprio nome é permitido", async () => {
    repo.buscarPorId.mockResolvedValue(epi);
    repo.renomear.mockResolvedValue({ ...epi, nome: "Epi" });

    await expect(renomearCategoria(admin, { id: "c1", nome: "Epi" })).resolves.toMatchObject({ nome: "Epi" });
  });

  it("recusa o nome de outra categoria", async () => {
    repo.buscarPorId.mockResolvedValue(epi);
    await expect(renomearCategoria(admin, { id: "c1", nome: "Elétrica" })).rejects.toMatchObject({
      codigo: "NOME_DUPLICADO",
    });
    expect(repo.renomear).not.toHaveBeenCalled();
  });

  it("categoria inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(renomearCategoria(admin, { id: "x", nome: "Qualquer" })).rejects.toMatchObject({
      codigo: "CATEGORIA_NAO_ENCONTRADA",
    });
  });
});

describe("alterarStatusCategoria", () => {
  it("desativa e reativa", async () => {
    repo.buscarPorId.mockResolvedValue(epi);
    repo.definirAtivo.mockResolvedValue({ ...epi, ativo: false });

    const resultado = await alterarStatusCategoria(admin, { id: "c1", ativo: false });

    expect(repo.definirAtivo).toHaveBeenCalledWith("c1", false);
    expect(resultado.ativo).toBe(false);
  });

  it("categoria inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(alterarStatusCategoria(admin, { id: "x", ativo: true })).rejects.toMatchObject({
      codigo: "CATEGORIA_NAO_ENCONTRADA",
    });
  });
});

describe("categoriaSchema", () => {
  it("apara o nome e exige de 1 a 100 caracteres", () => {
    expect(categoriaSchema.parse({ nome: "  EPI " })).toEqual({ nome: "EPI" });
    expect(categoriaSchema.safeParse({ nome: "   " }).success).toBe(false);
    expect(categoriaSchema.safeParse({ nome: "a".repeat(101) }).success).toBe(false);
    expect(categoriaSchema.safeParse({ nome: "a".repeat(100) }).success).toBe(true);
  });
});
