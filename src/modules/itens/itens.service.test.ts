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
vi.mock("@/infra/llm", () => ({ completarJson: vi.fn(), iaDisponivel: vi.fn(() => true) }));
vi.mock("@/modules/solicitacoes/solicitacoes.service", () => ({
  recusarPendentesDoItemArquivado: vi.fn(async () => []),
  notificarRecusasDoItemArquivado: vi.fn(async () => undefined),
  contarPendentesPorItem: vi.fn(async () => ({}) as Record<string, number>),
}));
vi.mock("@/modules/uts/uts.service", () => ({
  listarUtsAtivasPorIds: vi.fn(async (ids: string[]) => ids.map((id) => ({ id, rotulo: `UT ${id}` }))),
}));
vi.mock("./itens.repository", () => ({
  buscarIdPorRm: vi.fn(),
  buscarPorId: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  atualizarQuantidade: vi.fn(),
  listarPorUts: vi.fn(),
  listarVitrine: vi.fn(),
  buscarDaVitrine: vi.fn(),
}));

import { db } from "@/infra/db";
import { completarJson } from "@/infra/llm";
import { criarUrlsUpload, obterUrls, remover } from "@/infra/storage";
import {
  contarPendentesPorItem,
  recusarPendentesDoItemArquivado,
} from "@/modules/solicitacoes/solicitacoes.service";
import { listarUtsAtivasPorIds } from "@/modules/uts/uts.service";

import * as repository from "./itens.repository";
import type { ItemDetalheVitrineRegistro, ItemRegistro, ItemVitrineRegistro } from "./itens.repository";
import { filtrosVitrineSchema, type EditarItemEntrada, type ItemEntrada } from "./itens.schemas";
import {
  ajustarQuantidadeDisponivel,
  alterarArquivamento,
  criarItem,
  editarItem,
  estimarFreteDoItem,
  listarItensDaUt,
  listarVitrine,
  montarBuscaNormalizada,
  obterItemDaUt,
  obterItemDaVitrine,
  prepararUploadFotos,
} from "./itens.service";

const repo = vi.mocked(repository);

const almoxarife: UsuarioLogado = {
  id: "alm",
  nome: "Almoxarife",
  email: "alm@manserv.com.br",
  papel: "almoxarife",
  utId: "ut1",
  utsAdicionais: [],
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
  categoria: "material",
  segmento: "industrial",
  rm: "123456",
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
    categoria: "material",
    segmento: "industrial",
    rm: "123456",
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
    valorDepreciacaoMensal: null,
    larguraLoteCm: null,
    alturaLoteCm: null,
    profundidadeLoteCm: null,
    pesoLoteKg: null,
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
  repo.buscarIdPorRm.mockResolvedValue(null);
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
  const base = { nome: "Furadeira de Impacto", marca: "Bosch", modelo: "GSB 550", rm: "123456" } as const;

  it("junta nome, marca, modelo, RM, categoria, segmento e descrição, sem acento e em minúsculas", () => {
    expect(
      montarBuscaNormalizada({
        ...base,
        categoria: "ativo",
        segmento: "oleo_gas",
        descricao: "Com maleta  rígida",
      }),
    ).toBe("furadeira de impacto bosch gsb 550 123456 ativo oleo & gas com maleta rigida");
  });

  it("o segmento entra pelo rótulo, sem acento (Logística → logistica)", () => {
    expect(montarBuscaNormalizada({ ...base, categoria: "material", segmento: "logistica" })).toBe(
      "furadeira de impacto bosch gsb 550 123456 material logistica",
    );
  });

  it("cabe nos 500 caracteres da coluna e o que sobra é o fim da descrição", () => {
    const longa = montarBuscaNormalizada({
      ...base,
      categoria: "material",
      segmento: "energia",
      descricao: "palavra ".repeat(300),
    });
    expect(longa.length).toBe(500);
    expect(longa.startsWith("furadeira de impacto bosch gsb 550 123456 material energia palavra")).toBe(true);
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
      categoria: "material",
      segmento: "industrial",
      rm: "123456",
      valorDepreciacaoMensal: null,
      lote: null,
      quantidade: 3,
      status: "disponivel",
      dimensoesOrigem: "manual",
      iaResposta: null,
      descricao: "Com maleta",
      valorUnitarioReposicao: 450.9,
      fotos: [FOTO],
    });
    expect(dados.buscaNormalizada).toBe("furadeira de impacto bosch gsb 550 123456 material industrial com maleta");
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

  it("RM já usado por outro item é recusado antes de gravar", async () => {
    repo.buscarIdPorRm.mockResolvedValueOnce({ id: "outro-item" });
    await expect(criarItem(almoxarife, entrada)).rejects.toMatchObject({
      codigo: "RM_DUPLICADO",
      message: "Já existe um item cadastrado com este RM.",
    });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("duas gravações simultâneas com o mesmo RM: o índice único (P2002) vira RM duplicado", async () => {
    repo.criar.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    await expect(criarItem(almoxarife, entrada)).rejects.toMatchObject({ codigo: "RM_DUPLICADO" });
  });

  it("outro erro do banco não é confundido com RM duplicado", async () => {
    repo.criar.mockRejectedValueOnce(new Error("conexão perdida"));
    await expect(criarItem(almoxarife, entrada)).rejects.toThrow("conexão perdida");
  });

  it('"Ativo" grava a depreciação mensal; "Material" nunca grava', async () => {
    await criarItem(almoxarife, { ...entrada, categoria: "ativo", valorDepreciacaoMensal: 250 });
    expect(repo.criar.mock.calls[0][0]).toMatchObject({ categoria: "ativo", valorDepreciacaoMensal: 250 });

    // Mesmo que a entrada traga um valor, "Material" não tem depreciação.
    await criarItem(almoxarife, { ...entrada, categoria: "material", valorDepreciacaoMensal: 250 });
    expect(repo.criar.mock.calls[1][0].valorDepreciacaoMensal).toBeNull();
  });

  it("grava o lote quando os 4 valores vêm preenchidos", async () => {
    await criarItem(almoxarife, {
      ...entrada,
      larguraLoteCm: 120,
      alturaLoteCm: 80,
      profundidadeLoteCm: 100,
      pesoLoteKg: 350,
    });
    expect(repo.criar.mock.calls[0][0].lote).toEqual({ larguraCm: 120, alturaCm: 80, profundidadeCm: 100, pesoKg: 350 });
  });

  it("lote incompleto na entrada nunca é gravado pela metade", async () => {
    await criarItem(almoxarife, { ...entrada, larguraLoteCm: 120 });
    expect(repo.criar.mock.calls[0][0].lote).toBeNull();
  });

  it("o DTO traz categoria, segmento, RM, depreciação e lote", async () => {
    repo.criar.mockResolvedValue(
      registro({
        categoria: "ativo",
        segmento: "mineracao",
        rm: "000789",
        valorDepreciacaoMensal: new Prisma.Decimal("250.5"),
        larguraLoteCm: new Prisma.Decimal("120"),
        alturaLoteCm: new Prisma.Decimal("80"),
        profundidadeLoteCm: new Prisma.Decimal("100"),
        pesoLoteKg: new Prisma.Decimal("350.25"),
      }),
    );
    const dto = await criarItem(almoxarife, entrada);
    expect(dto).toMatchObject({
      categoria: "ativo",
      segmento: "mineracao",
      rm: "000789",
      valorDepreciacaoMensal: 250.5,
      lote: { larguraCm: 120, alturaCm: 80, profundidadeCm: 100, pesoKg: 350.25 },
    });
  });

  it("item antigo sem segmento, RM, depreciação e lote vira nulos no DTO", async () => {
    repo.criar.mockResolvedValue(registro({ segmento: null, rm: null }));
    const dto = await criarItem(almoxarife, entrada);
    expect(dto).toMatchObject({ segmento: null, rm: null, valorDepreciacaoMensal: null, lote: null });
  });

  it("sem dimensões nem peso na entrada, grava nulos (não undefined)", async () => {
    const { larguraCm, alturaCm, profundidadeCm, pesoKg, ...semMedidas } = entrada;
    void [larguraCm, alturaCm, profundidadeCm, pesoKg];
    await criarItem(almoxarife, semMedidas);
    expect(repo.criar.mock.calls[0][0]).toMatchObject({
      larguraCm: null,
      alturaCm: null,
      profundidadeCm: null,
      pesoKg: null,
    });
  });

  it("item sem dimensões e peso vira nulos no DTO (não quebra em toNumber)", async () => {
    repo.criar.mockResolvedValue(
      registro({ larguraCm: null, alturaCm: null, profundidadeCm: null, pesoKg: null }),
    );
    const dto = await criarItem(almoxarife, entrada);
    expect(dto).toMatchObject({ larguraCm: null, alturaCm: null, profundidadeCm: null, pesoKg: null });
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

  it("o item pode manter o próprio RM", async () => {
    repo.buscarIdPorRm.mockResolvedValueOnce({ id: "item1" });
    await expect(editarItem(almoxarife, entradaEdicao)).resolves.toBeDefined();
  });

  it("RM de outro item é recusado e nada é gravado", async () => {
    repo.buscarIdPorRm.mockResolvedValueOnce({ id: "outro-item" });
    await expect(editarItem(almoxarife, entradaEdicao)).rejects.toMatchObject({ codigo: "RM_DUPLICADO" });
    expect(repo.atualizar).not.toHaveBeenCalled();
  });

  it("conflito do índice único na transação também vira RM duplicado", async () => {
    repo.atualizar.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    await expect(editarItem(almoxarife, entradaEdicao)).rejects.toMatchObject({ codigo: "RM_DUPLICADO" });
  });

  it("grava as novas regras: categoria, segmento, RM, depreciação e lote, e troca a depreciação ao virar Material", async () => {
    await editarItem(almoxarife, {
      ...entradaEdicao,
      categoria: "ativo",
      segmento: "facilities",
      rm: "555",
      valorDepreciacaoMensal: 90,
      larguraLoteCm: 10,
      alturaLoteCm: 20,
      profundidadeLoteCm: 30,
      pesoLoteKg: 40,
    });
    expect(repo.atualizar.mock.calls[0][1]).toMatchObject({
      categoria: "ativo",
      segmento: "facilities",
      rm: "555",
      valorDepreciacaoMensal: 90,
      lote: { larguraCm: 10, alturaCm: 20, profundidadeCm: 30, pesoKg: 40 },
    });

    await editarItem(almoxarife, { ...entradaEdicao, categoria: "material", valorDepreciacaoMensal: 90 });
    expect(repo.atualizar.mock.calls[1][1]).toMatchObject({ categoria: "material", valorDepreciacaoMensal: null, lote: null });
  });

  it("a busca normalizada é refeita com RM, categoria e segmento", async () => {
    await editarItem(almoxarife, { ...entradaEdicao, categoria: "ativo", segmento: "energia", rm: "42" });
    expect(repo.atualizar.mock.calls[0][1].buscaNormalizada).toBe(
      "furadeira de impacto bosch gsb 550 42 ativo energia com maleta",
    );
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
    expect(repo.atualizarQuantidade).toHaveBeenCalledWith(
      "item1",
      { quantidadeDisponivel: 6, quantidadeTotal: 10, status: "arquivado" },
      TX,
    );
  });

  it("arquivar recusa as pendentes do item na mesma transação (regra 4)", async () => {
    repo.buscarPorId.mockResolvedValue(registro());
    await alterarArquivamento(almoxarife, { id: "item1", arquivar: true });
    expect(recusarPendentesDoItemArquivado).toHaveBeenCalledWith("item1", TX);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("reativar não mexe nas solicitações", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ status: "arquivado", quantidadeDisponivel: 6 }));
    await alterarArquivamento(almoxarife, { id: "item1", arquivar: false });
    expect(recusarPendentesDoItemArquivado).not.toHaveBeenCalled();
  });

  it("não recusa as pendentes quando o item já estava arquivado", async () => {
    repo.buscarPorId.mockResolvedValue(registro({ status: "arquivado" }));
    await alterarArquivamento(almoxarife, { id: "item1", arquivar: true });
    expect(recusarPendentesDoItemArquivado).not.toHaveBeenCalled();
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

function registroVitrine(parcial: Partial<ItemVitrineRegistro> = {}): ItemVitrineRegistro {
  return {
    ...registro({ utId: "ut2" }),
    ut: { id: "ut2", nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" },
    fotos: [{ chaveThumb: FOTO.chaveThumb }],
    ...parcial,
  } as ItemVitrineRegistro;
}

const filtrosPadrao = filtrosVitrineSchema.parse({});

describe("filtrosVitrineSchema", () => {
  it("usa os padrões quando a URL não traz nada", () => {
    expect(filtrosPadrao).toEqual({ ordenar: "recentes", pagina: 1 });
  });

  it("lê os filtros da URL e normaliza a UF", () => {
    const r = filtrosVitrineSchema.parse({
      busca: "  furadeira bosch ",
      categoria: "ativo",
      segmento: "energia",
      uf: "mg",
      utId: "ut2",
      estado: "novo",
      ordenar: "maior_valor",
      pagina: "3",
    });
    expect(r).toEqual({
      busca: "furadeira bosch",
      categoria: "ativo",
      segmento: "energia",
      uf: "MG",
      utId: "ut2",
      estado: "novo",
      ordenar: "maior_valor",
      pagina: 3,
    });
  });

  it("ignora valores inválidos em vez de falhar", () => {
    const r = filtrosVitrineSchema.parse({
      uf: "XX",
      estado: "quebrado",
      categoria: "outra",
      segmento: "varejo",
      ordenar: "aleatorio",
      pagina: "-2",
    });
    expect(r).toEqual({ ordenar: "recentes", pagina: 1 });
  });
});

describe("listarVitrine", () => {
  beforeEach(() => {
    repo.listarVitrine.mockResolvedValue({ itens: [registroVitrine()], total: 1 });
  });

  it("monta a página com UT, miniatura assinada em lote e o marcador da própria UT", async () => {
    repo.listarVitrine.mockResolvedValue({
      itens: [
        registroVitrine(),
        registroVitrine({ id: "item2", utId: "ut1", ut: { id: "ut1", nome: "Minha UT", cidade: "Santos", uf: "SP" } }),
        registroVitrine({ id: "item3", fotos: [] }),
      ],
      total: 3,
    });
    const r = await listarVitrine(almoxarife, filtrosPadrao);

    expect(r.itens.map((i) => i.daMinhaUt)).toEqual([false, true, false]);
    expect(r.itens[0].urlMiniatura).toBe(`https://dl/${FOTO.chaveThumb}`);
    expect(r.itens[2].urlMiniatura).toBeNull();
    expect(r.itens[0].ut).toEqual({ id: "ut2", nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" });
    expect(r.itens[0].valorUnitarioReposicao).toBe(450.9);
    expect(r).toMatchObject({ total: 3, pagina: 1, totalPaginas: 1, porPagina: 24 });
    // Uma única chamada de assinatura para todas as capas (SPEC §6.3).
    expect(obterUrls).toHaveBeenCalledTimes(1);
    expect(vi.mocked(obterUrls).mock.calls[0][1]).toBe(3600);
  });

  it("assina as miniaturas por 1h e não chama o storage quando não há capas", async () => {
    repo.listarVitrine.mockResolvedValue({ itens: [], total: 0 });
    await listarVitrine(colaborador, filtrosPadrao);
    expect(obterUrls).not.toHaveBeenCalled();
  });

  it("normaliza o termo (sem acento, minúsculas) e o separa em palavras", async () => {
    await listarVitrine(colaborador, { ...filtrosPadrao, busca: "  FURADEIRA   Elétrica  " });
    expect(repo.listarVitrine.mock.calls[0][0].termos).toEqual(["furadeira", "eletrica"]);
  });

  it("repassa filtros, ordenação e o tamanho da página", async () => {
    await listarVitrine(colaborador, {
      ...filtrosPadrao,
      categoria: "ativo",
      segmento: "oleo_gas",
      uf: "MG",
      utId: "ut2",
      estado: "novo",
      ordenar: "maior_valor",
      pagina: 2,
    });
    expect(repo.listarVitrine.mock.calls[0][0]).toEqual({
      termos: [],
      categoria: "ativo",
      segmento: "oleo_gas",
      uf: "MG",
      utId: "ut2",
      estado: "novo",
      ordenar: "maior_valor",
      pagina: 2,
      porPagina: 24,
    });
  });

  it("calcula o total de páginas de 24", async () => {
    repo.listarVitrine.mockResolvedValue({ itens: [registroVitrine()], total: 49 });
    const r = await listarVitrine(colaborador, { ...filtrosPadrao, pagina: 3 });
    expect(r.totalPaginas).toBe(3);
    expect(r.pagina).toBe(3);
  });

  it("página além do fim cai na última", async () => {
    repo.listarVitrine
      .mockResolvedValueOnce({ itens: [], total: 30 })
      .mockResolvedValueOnce({ itens: [registroVitrine()], total: 30 });
    const r = await listarVitrine(colaborador, { ...filtrosPadrao, pagina: 9 });

    expect(repo.listarVitrine).toHaveBeenCalledTimes(2);
    expect(repo.listarVitrine.mock.calls[1][0].pagina).toBe(2);
    expect(r).toMatchObject({ pagina: 2, totalPaginas: 2 });
    expect(r.itens).toHaveLength(1);
  });

  it("admin não tem UT: nenhum item é da própria UT", async () => {
    const r = await listarVitrine(admin, filtrosPadrao);
    expect(r.itens.every((i) => !i.daMinhaUt)).toBe(true);
  });

  it("recusa usuário inativo", async () => {
    await expect(listarVitrine({ ...colaborador, ativo: false }, filtrosPadrao)).rejects.toMatchObject({
      codigo: "USUARIO_INATIVO",
    });
    expect(repo.listarVitrine).not.toHaveBeenCalled();
  });
});

describe("obterItemDaVitrine", () => {
  const FOTO2 = {
    chave: "fotos/2026/10/323e4567-e89b-12d3-a456-426614174000.jpg",
    chaveThumb: "fotos/2026/10/323e4567-e89b-12d3-a456-426614174000_thumb.jpg",
  };

  function detalhe(parcial: Partial<ItemDetalheVitrineRegistro> = {}): ItemDetalheVitrineRegistro {
    return {
      ...registro({ utId: "ut2" }),
      ut: { id: "ut2", nome: "BASE OPERACIONAL PARADAS", cidade: "Uberaba", uf: "MG" },
      fotos: [
        { ...FOTO, ordem: 0 },
        { ...FOTO2, ordem: 1 },
      ],
      ...parcial,
    } as ItemDetalheVitrineRegistro;
  }

  beforeEach(() => {
    repo.buscarDaVitrine.mockResolvedValue(detalhe());
  });

  it("devolve os dados do item, a UT de origem e as fotos assinadas em lote (1h)", async () => {
    const r = await obterItemDaVitrine(colaborador, "item1");

    expect(r).toMatchObject({
      id: "item1",
      valorUnitarioReposicao: 450.9,
      larguraCm: 30,
      pesoKg: 2.1,
      dimensoesOrigem: "manual",
      criadoEm: "2026-10-13T12:00:00.000Z",
      ut: { id: "ut2", cidade: "Uberaba", uf: "MG" },
      daMinhaUt: false,
      podeSolicitar: true,
      utsDestino: [{ id: "ut1", rotulo: "UT ut1" }],
    });
    expect(r.fotos).toEqual([
      { urlPrincipal: `https://dl/${FOTO.chave}`, urlMiniatura: `https://dl/${FOTO.chaveThumb}` },
      { urlPrincipal: `https://dl/${FOTO2.chave}`, urlMiniatura: `https://dl/${FOTO2.chaveThumb}` },
    ]);
    expect(obterUrls).toHaveBeenCalledTimes(1);
    expect(vi.mocked(obterUrls).mock.calls[0][1]).toBe(3600);
  });

  it("item sem dimensões e peso (inventário importado) aparece com nulos, sem quebrar", async () => {
    repo.buscarDaVitrine.mockResolvedValue(
      detalhe({ larguraCm: null, alturaCm: null, profundidadeCm: null, pesoKg: null }),
    );
    const r = await obterItemDaVitrine(colaborador, "item1");
    expect(r).toMatchObject({ larguraCm: null, alturaCm: null, profundidadeCm: null, pesoKg: null, lote: null });
  });

  it("item da própria UT não pode ser solicitado (regra 5)", async () => {
    repo.buscarDaVitrine.mockResolvedValue(detalhe({ utId: "ut1" }));
    const r = await obterItemDaVitrine(almoxarife, "item1");
    expect(r.daMinhaUt).toBe(true);
    expect(r.podeSolicitar).toBe(false);
  });

  it("com várias UTs, o destino pode ser qualquer uma, menos a do item", async () => {
    repo.buscarDaVitrine.mockResolvedValue(detalhe({ utId: "ut1" }));
    const r = await obterItemDaVitrine({ ...almoxarife, utsAdicionais: ["ut4", "ut5"] }, "item1");
    expect(r.daMinhaUt).toBe(true);
    expect(r.podeSolicitar).toBe(true);
    expect(r.utsDestino.map((ut) => ut.id)).toEqual(["ut4", "ut5"]);
  });

  it("admin vê o item, mas não solicita", async () => {
    const r = await obterItemDaVitrine(admin, "item1");
    expect(r.daMinhaUt).toBe(false);
    expect(r.podeSolicitar).toBe(false);
  });

  it("item fora da vitrine (esgotado, arquivado, UT inativa ou inexistente) não é encontrado", async () => {
    repo.buscarDaVitrine.mockResolvedValue(null);
    await expect(obterItemDaVitrine(colaborador, "item1")).rejects.toMatchObject({ codigo: "ITEM_NAO_ENCONTRADO" });
    expect(obterUrls).not.toHaveBeenCalled();
  });

  it("recusa usuário inativo", async () => {
    await expect(obterItemDaVitrine({ ...colaborador, ativo: false }, "item1")).rejects.toMatchObject({
      codigo: "USUARIO_INATIVO",
    });
    expect(repo.buscarDaVitrine).not.toHaveBeenCalled();
  });
});

describe("listarItensDaUt", () => {
  it("lista só a UT da sessão, com a miniatura da capa assinada", async () => {
    repo.listarPorUts.mockResolvedValue([registro(), registro({ id: "item2", fotos: [] })]);
    const r = await listarItensDaUt(almoxarife);

    expect(repo.listarPorUts).toHaveBeenCalledWith(["ut1"]);
    expect(r).toHaveLength(2);
    expect(r[0].urlMiniatura).toBe(`https://dl/${FOTO.chaveThumb}`);
    expect(r[1].urlMiniatura).toBeNull();
  });

  it("informa quantas solicitações pendentes cada item tem", async () => {
    repo.listarPorUts.mockResolvedValue([registro(), registro({ id: "item2", fotos: [] })]);
    vi.mocked(contarPendentesPorItem).mockResolvedValue({ item1: 3 });

    const r = await listarItensDaUt(almoxarife);

    expect(contarPendentesPorItem).toHaveBeenCalledWith(["item1", "item2"]);
    expect(r.map((item) => item.solicitacoesPendentes)).toEqual([3, 0]);
  });

  it("almoxarife sem UT não vê nada", async () => {
    expect(await listarItensDaUt({ ...almoxarife, utId: null })).toEqual([]);
    expect(repo.listarPorUts).not.toHaveBeenCalled();
  });

  it("só almoxarife lista", async () => {
    await expect(listarItensDaUt(colaborador)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(listarItensDaUt(admin)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });
});

describe("estimarFreteDoItem", () => {
  const llm = vi.mocked(completarJson);
  const entrada = { itemId: "item1", utDestinoId: "ut1", quantidade: 2 };

  beforeEach(() => {
    repo.buscarDaVitrine.mockResolvedValue({
      ...registro({ utId: "ut2" }),
      ut: { id: "ut2", nome: "BASE", cidade: "Uberaba", uf: "MG" },
    } as ItemDetalheVitrineRegistro);
    vi.mocked(listarUtsAtivasPorIds).mockResolvedValue([
      { id: "ut1", codigo: "1", nome: "SEDE", cidade: "Campinas", uf: "SP", ativo: true, rotulo: "", criadoEm: "" },
    ]);
    llm.mockReset();
    llm.mockResolvedValue({
      distanciaKm: 480,
      transportadora: { min: 80, max: 180 },
      veiculoProprio: { min: 900, max: 1000 },
      justificativa: "Carga pequena.",
    });
  });

  it("compara compra nova, transportadora e veículo próprio com a carga da quantidade", async () => {
    const r = await estimarFreteDoItem(colaborador, entrada);
    expect(r).toMatchObject({
      origem: "Uberaba/MG",
      destino: "Campinas/SP",
      compraNova: 901.8,
      carga: { medidasInformadas: true, pesoTotalKg: 4.2, volumeTotalM3: 0.015 },
      recomendada: "transportadora",
    });
  });

  it("valida destino, quantidade e papel", async () => {
    await expect(estimarFreteDoItem(colaborador, { ...entrada, utDestinoId: "ut9" })).rejects.toMatchObject({
      codigo: "UT_DESTINO_INVALIDA",
    });
    await expect(estimarFreteDoItem(colaborador, { ...entrada, quantidade: 4 })).rejects.toMatchObject({
      codigo: "QUANTIDADE_INDISPONIVEL",
    });
    await expect(estimarFreteDoItem(admin, entrada)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });

    repo.buscarDaVitrine.mockResolvedValue({
      ...registro({ utId: "ut1" }),
      ut: { id: "ut1", nome: "SEDE", cidade: "Campinas", uf: "SP" },
    } as ItemDetalheVitrineRegistro);
    await expect(estimarFreteDoItem(colaborador, entrada)).rejects.toMatchObject({ codigo: "ITEM_DA_PROPRIA_UT" });
  });

  it("sem resposta da IA, avisa que não deu para estimar", async () => {
    llm.mockResolvedValue(null);
    await expect(estimarFreteDoItem(colaborador, entrada)).rejects.toMatchObject({ codigo: "IA_INDISPONIVEL" });
  });
});
