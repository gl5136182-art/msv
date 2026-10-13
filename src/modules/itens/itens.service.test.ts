import { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chaveFotoValida } from "@/lib/chaves-foto";
import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("@/infra/storage", () => ({
  criarUrlsUpload: vi.fn(async (chaves: string[]) => chaves.map((chave) => ({ chave, url: `https://up/${chave}` }))),
  obterUrls: vi.fn(async (chaves: string[]) => Object.fromEntries(chaves.map((c) => [c, `https://dl/${c}`]))),
  remover: vi.fn(async () => undefined),
}));
vi.mock("@/infra/db", () => ({ db: { $transaction: vi.fn() } }));
vi.mock("./itens.repository", () => ({
  buscarCategoria: vi.fn(),
  buscarPorId: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  atualizarQuantidade: vi.fn(),
  listarPorUt: vi.fn(),
}));

import { db } from "@/infra/db";
import { criarUrlsUpload, remover } from "@/infra/storage";

import * as repository from "./itens.repository";
import type { ItemRegistro } from "./itens.repository";
import type { EditarItemEntrada, ItemEntrada } from "./itens.schemas";
import {
  ajustarQuantidadeDisponivel,
  alterarArquivamento,
  criarItem,
  editarItem,
  listarItensDaUt,
  montarBuscaNormalizada,
  obterItemDaUt,
  prepararUploadFotos,
} from "./itens.service";

const repo = vi.mocked(repository);

const almoxarife: UsuarioLogado = {
  id: "alm",
  nome: "Almoxarife",
  email: "alm@manserv.com.br",
  papel: "almoxarife",
  utId: "ut1",
  ativo: true,
  deveTrocarSenha: false,
};
const colaborador: UsuarioLogado = { ...almoxarife, id: "col", papel: "colaborador" };
const admin: UsuarioLogado = { ...almoxarife, id: "adm", papel: "admin", utId: null };

const FOTO = {
  chave: "fotos/2026/10/123e4567-e89b-12d3-a456-426614174000.jpg",
  chaveThumb: "fotos/2026/10/123e4567-e89b-12d3-a456-426614174000_thumb.jpg",
};
const FOTO_NOVA = {
  chave: "fotos/2026/10/223e4567-e89b-12d3-a456-426614174000.jpg",
  chaveThumb: "fotos/2026/10/223e4567-e89b-12d3-a456-426614174000_thumb.jpg",
};

const entrada: ItemEntrada = {
  nome: "Furadeira de impacto",
  categoriaId: "cat1",
  marca: "Bosch",
  modelo: "GSB 550",
  descricao: "Com maleta",
  estado: "usado_bom",
  unidade: "un",
  quantidade: 3,
  valorUnitarioReposicao: 450.9,
  larguraCm: 30,
  alturaCm: 25,
  profundidadeCm: 10,
  pesoKg: 2.1,
  fotos: [FOTO],
};

const entradaEdicao: EditarItemEntrada = { ...entrada, id: "item1" };

function registro(parcial: Partial<ItemRegistro> = {}): ItemRegistro {
  return {
    id: "item1",
    utId: "ut1",
    criadoPorId: "alm",
    categoriaId: "cat1",
    categoria: { id: "cat1", nome: "Ferramentas elétricas" },
    nome: "Furadeira de impacto",
    marca: "Bosch",
    modelo: "GSB 550",
    descricao: null,
    estado: "usado_bom",
    unidade: "un",
    quantidadeTotal: 3,
    quantidadeDisponivel: 3,
    valorUnitarioReposicao: new Prisma.Decimal("450.90"),
    larguraCm: new Prisma.Decimal("30"),
    alturaCm: new Prisma.Decimal("25"),
    profundidadeCm: new Prisma.Decimal("10"),
    pesoKg: new Prisma.Decimal("2.1"),
    dimensoesOrigem: "manual",
    iaResposta: null,
    buscaNormalizada: "furadeira",
    status: "disponivel",
    criadoEm: new Date("2026-10-13T12:00:00Z"),
    atualizadoEm: new Date("2026-10-13T12:00:00Z"),
    fotos: [{ ...FOTO, ordem: 0 }],
    ...parcial,
  } as ItemRegistro;
}

const TX = { tx: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => fn(TX)) as never);
  repo.buscarCategoria.mockResolvedValue({ id: "cat1", nome: "Ferramentas elétricas", ativo: true });
});

describe("prepararUploadFotos", () => {
  it("gera principal e miniatura para cada foto, com chaves no formato do storage", async () => {
    const r = await prepararUploadFotos(almoxarife, { quantidade: 2 });

    expect(r).toHaveLength(2);
    for (const foto of r) {
      expect(chaveFotoValida(foto.chave)).toBe(true);
      expect(chaveFotoValida(foto.chaveThumb)).toBe(true);
      expect(foto.chaveThumb).toBe(foto.chave.replace(".jpg", "_thumb.jpg"));
      expect(foto.urlUpload).toBe(`https://up/${foto.chave}`);
      expect(foto.urlUploadThumb).toBe(`https://up/${foto.chaveThumb}`);
    }
    expect(r[0].chave).not.toBe(r[1].chave);
    expect(criarUrlsUpload).toHaveBeenCalledTimes(1);
    expect(vi.mocked(criarUrlsUpload).mock.calls[0][0]).toHaveLength(4);
  });

  it("só o almoxarife envia fotos", async () => {
    await expect(prepararUploadFotos(colaborador, { quantidade: 1 })).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
    await expect(prepararUploadFotos(admin, { quantidade: 1 })).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
    expect(criarUrlsUpload).not.toHaveBeenCalled();
  });

  it("recusa usuário inativo", async () => {
    await expect(prepararUploadFotos({ ...almoxarife, ativo: false }, { quantidade: 1 })).rejects.toMatchObject({
      codigo: "USUARIO_INATIVO",
    });
  });
});

describe("montarBuscaNormalizada", () => {
  it("junta nome, marca, modelo, descrição e categoria, sem acento e em minúsculas", () => {
    expect(
      montarBuscaNormalizada(
        { nome: "Furadeira de Impacto", marca: "Bosch", modelo: "GSB 550", descricao: "Com maleta  rígida" },
        "Ferramentas elétricas",
      ),
    ).toBe("furadeira de impacto bosch gsb 550 com maleta rigida ferramentas eletricas");
  });

  it("aceita item sem descrição", () => {
    expect(montarBuscaNormalizada({ nome: "Cabo", marca: "X", modelo: "Y" }, "Elétrica")).toBe("cabo x y eletrica");
  });

  it("cabe nos 500 caracteres da coluna", () => {
    const longa = montarBuscaNormalizada(
      { nome: "A", marca: "B", modelo: "C", descricao: "palavra ".repeat(300) },
      "Outros",
    );
    expect(longa.length).toBe(500);
  });
});

describe("criarItem", () => {
  beforeEach(() => {
    repo.criar.mockResolvedValue(registro());
  });

  it("grava na UT da sessão, com quantidade total = disponível, status disponível e dimensões manuais", async () => {
    const dto = await criarItem(almoxarife, entrada);

    expect(repo.criar).toHaveBeenCalledTimes(1);
    const dados = repo.criar.mock.calls[0][0];
    expect(dados).toMatchObject({
      utId: "ut1",
      criadoPorId: "alm",
      categoriaId: "cat1",
      quantidade: 3,
      status: "disponivel",
      dimensoesOrigem: "manual",
      iaResposta: null,
      descricao: "Com maleta",
      valorUnitarioReposicao: 450.9,
      fotos: [FOTO],
    });
    expect(dados.buscaNormalizada).toBe("furadeira de impacto bosch gsb 550 com maleta ferramentas eletricas");
    // DTO: Decimal vira number, Date vira ISO.
    expect(dto.valorUnitarioReposicao).toBe(450.9);
    expect(dto.pesoKg).toBe(2.1);
    expect(dto.criadoEm).toBe("2026-10-13T12:00:00.000Z");
  });

  it("só almoxarife cadastra (colaborador e admin não)", async () => {
    await expect(criarItem(colaborador, entrada)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(criarItem(admin, entrada)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("recusa almoxarife sem UT", async () => {
    await expect(criarItem({ ...almoxarife, utId: null }, entrada)).rejects.toMatchObject({ codigo: "SEM_UT" });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("recusa categoria inexistente ou desativada", async () => {
    repo.buscarCategoria.mockResolvedValueOnce(null);
    await expect(criarItem(almoxarife, entrada)).rejects.toMatchObject({ codigo: "CATEGORIA_INVALIDA" });

    repo.buscarCategoria.mockResolvedValueOnce({ id: "cat1", nome: "X", ativo: false });
    await expect(criarItem(almoxarife, entrada)).rejects.toMatchObject({ codigo: "CATEGORIA_INVALIDA" });
    expect(repo.criar).not.toHaveBeenCalled();
  });
});

describe("editarItem", () => {
  beforeEach(() => {
    repo.buscarPorId.mockResolvedValue(registro({ fotos: [{ ...FOTO, ordem: 0 }] }));
    repo.atualizar.mockResolvedValue(registro({ fotos: [{ ...FOTO_NOVA, ordem: 0 }] }));
  });

  it("atualiza dados e fotos na transação, sem tocar em quantidade, status nem UT", async () => {
    await editarItem(almoxarife, { ...entradaEdicao, fotos: [FOTO_NOVA] });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const [id, dados, cliente] = repo.atualizar.mock.calls[0];
    expect(id).toBe("item1");
    expect(cliente).toBe(TX);
    expect(dados.fotos).toEqual([FOTO_NOVA]);
    expect(dados).not.toHaveProperty("utId");
    expect(dados).not.toHaveProperty("quantidade");
    expect(dados).not.toHaveProperty("status");
  });

  it("remove do storage só as fotos que saíram da lista", async () => {
    await editarItem(almoxarife, { ...entradaEdicao, fotos: [FOTO_NOVA] });
    expect(remover).toHaveBeenCalledWith([FOTO.chave, FOTO.chaveThumb]);
  });

  it("não remove nada quando as fotos são as mesmas", async () => {
    await editarItem(almoxarife, entradaEdicao);
    expect(remover).not.toHaveBeenCalled();
  });

  it("falha ao remover do storage não desfaz a edição", async () => {
    vi.mocked(remover).mockRejectedValueOnce(new Error("storage fora do ar"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(editarItem(almoxarife, { ...entradaEdicao, fotos: [FOTO_NOVA] })).resolves.toBeDefined();
    erro.mockRestore();
  });

  it("só o almoxarife da UT do item edita", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ utId: "outra-ut" }));
    await expect(editarItem(almoxarife, entradaEdicao)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.atualizar).not.toHaveBeenCalled();
  });

  it("colaborador e admin não editam", async () => {
    await expect(editarItem(colaborador, entradaEdicao)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(editarItem(admin, entradaEdicao)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.buscarPorId).not.toHaveBeenCalled();
  });

  it("item inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(editarItem(almoxarife, entradaEdicao)).rejects.toMatchObject({ codigo: "ITEM_NAO_ENCONTRADO" });
  });

  it("categoria desativada: aceita se for a que o item já tem, recusa se for outra", async () => {
    repo.buscarCategoria.mockResolvedValue({ id: "cat1", nome: "Antiga", ativo: false });
    await expect(editarItem(almoxarife, entradaEdicao)).resolves.toBeDefined();

    repo.buscarCategoria.mockResolvedValue({ id: "cat2", nome: "Outra", ativo: false });
    await expect(editarItem(almoxarife, { ...entradaEdicao, categoriaId: "cat2" })).rejects.toMatchObject({
      codigo: "CATEGORIA_INVALIDA",
    });
  });
});

describe("obterItemDaUt", () => {
  it("devolve o item da própria UT e nega o de outra", async () => {
    repo.buscarPorId.mockResolvedValueOnce(registro());
    await expect(obterItemDaUt(almoxarife, "item1")).resolves.toMatchObject({
      id: "item1",
      previas: { [FOTO.chaveThumb]: `https://dl/${FOTO.chaveThumb}` },
    });

    repo.buscarPorId.mockResolvedValueOnce(registro({ utId: "outra-ut" }));
    await expect(obterItemDaUt(almoxarife, "item1")).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });
});

describe("ajustarQuantidadeDisponivel", () => {
  beforeEach(() => {
    repo.buscarPorId.mockResolvedValue(registro({ quantidadeTotal: 10, quantidadeDisponivel: 6 }));
    repo.atualizarQuantidade.mockResolvedValue(registro());
  });

  it("reduzir mantém o total e o status", async () => {
    await ajustarQuantidadeDisponivel(almoxarife, { id: "item1", quantidadeDisponivel: 2 });
    expect(repo.atualizarQuantidade).toHaveBeenCalledWith("item1", {
      quantidadeDisponivel: 2,
      quantidadeTotal: 10,
      status: "disponivel",
    });
  });

  it("zerar esgota o item (sai da vitrine)", async () => {
    await ajustarQuantidadeDisponivel(almoxarife, { id: "item1", quantidadeDisponivel: 0 });
    expect(repo.atualizarQuantidade.mock.calls[0][1]).toMatchObject({ quantidadeDisponivel: 0, status: "esgotado" });
  });

  it("voltar a > 0 reativa o item esgotado", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ quantidadeTotal: 10, quantidadeDisponivel: 0, status: "esgotado" }));
    await ajustarQuantidadeDisponivel(almoxarife, { id: "item1", quantidadeDisponivel: 3 });
    expect(repo.atualizarQuantidade.mock.calls[0][1]).toMatchObject({ quantidadeDisponivel: 3, status: "disponivel" });
  });

  it("passar do total sobe o total junto", async () => {
    await ajustarQuantidadeDisponivel(almoxarife, { id: "item1", quantidadeDisponivel: 14 });
    expect(repo.atualizarQuantidade.mock.calls[0][1]).toMatchObject({ quantidadeDisponivel: 14, quantidadeTotal: 14 });
  });

  it("item arquivado continua arquivado", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ status: "arquivado" }));
    await ajustarQuantidadeDisponivel(almoxarife, { id: "item1", quantidadeDisponivel: 0 });
    expect(repo.atualizarQuantidade.mock.calls[0][1].status).toBe("arquivado");
  });

  it("só o almoxarife da UT do item ajusta", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ utId: "outra-ut" }));
    await expect(ajustarQuantidadeDisponivel(almoxarife, { id: "item1", quantidadeDisponivel: 1 })).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
    await expect(ajustarQuantidadeDisponivel(colaborador, { id: "item1", quantidadeDisponivel: 1 })).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
    expect(repo.atualizarQuantidade).not.toHaveBeenCalled();
  });
});

describe("alterarArquivamento", () => {
  beforeEach(() => {
    repo.atualizarQuantidade.mockResolvedValue(registro());
  });

  it("arquivar tira o item da vitrine, mantendo as quantidades", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ quantidadeTotal: 10, quantidadeDisponivel: 6 }));
    await alterarArquivamento(almoxarife, { id: "item1", arquivar: true });
    expect(repo.atualizarQuantidade).toHaveBeenCalledWith("item1", {
      quantidadeDisponivel: 6,
      quantidadeTotal: 10,
      status: "arquivado",
    });
  });

  it("reativar volta a disponível quando há unidades", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ status: "arquivado", quantidadeDisponivel: 6 }));
    await alterarArquivamento(almoxarife, { id: "item1", arquivar: false });
    expect(repo.atualizarQuantidade.mock.calls[0][1].status).toBe("disponivel");
  });

  it("reativar sem unidades deixa esgotado", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ status: "arquivado", quantidadeDisponivel: 0 }));
    await alterarArquivamento(almoxarife, { id: "item1", arquivar: false });
    expect(repo.atualizarQuantidade.mock.calls[0][1].status).toBe("esgotado");
  });

  it("não grava nada quando o status já é o pedido", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ status: "arquivado" }));
    await alterarArquivamento(almoxarife, { id: "item1", arquivar: true });
    expect(repo.atualizarQuantidade).not.toHaveBeenCalled();
  });

  it("só o almoxarife da UT do item arquiva", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ utId: "outra-ut" }));
    await expect(alterarArquivamento(almoxarife, { id: "item1", arquivar: true })).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
    await expect(alterarArquivamento(admin, { id: "item1", arquivar: true })).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
    expect(repo.atualizarQuantidade).not.toHaveBeenCalled();
  });
});

describe("listarItensDaUt", () => {
  it("lista só a UT da sessão, com a miniatura da capa assinada", async () => {
    repo.listarPorUt.mockResolvedValue([registro(), registro({ id: "item2", fotos: [] })]);
    const r = await listarItensDaUt(almoxarife);

    expect(repo.listarPorUt).toHaveBeenCalledWith("ut1");
    expect(r).toHaveLength(2);
    expect(r[0].urlMiniatura).toBe(`https://dl/${FOTO.chaveThumb}`);
    expect(r[1].urlMiniatura).toBeNull();
  });

  it("almoxarife sem UT não vê nada", async () => {
    expect(await listarItensDaUt({ ...almoxarife, utId: null })).toEqual([]);
    expect(repo.listarPorUt).not.toHaveBeenCalled();
  });

  it("só almoxarife lista", async () => {
    await expect(listarItensDaUt(colaborador)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(listarItensDaUt(admin)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });
});
