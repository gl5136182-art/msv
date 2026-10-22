import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("@/infra/db", () => ({ db: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn("tx")) } }));
vi.mock("@/infra/llm", () => ({ completarJson: vi.fn(async () => null), iaDisponivel: vi.fn(() => false) }));
vi.mock("@/infra/storage", () => ({ obterUrls: vi.fn(async () => ({})) }));
vi.mock("@/modules/itens/itens.service", () => ({ buscarCandidatosReuso: vi.fn() }));
vi.mock("@/modules/uts/uts.service", () => ({ listarUtsAtivasPorIds: vi.fn(async () => []) }));
vi.mock("./requisicoes.repository", () => ({
  buscarPorId: vi.fn(),
  listar: vi.fn(),
  criar: vi.fn(),
  substituirRascunho: vi.fn(),
  gravarAnalise: vi.fn(),
  mudarStatusSe: vi.fn(),
  contarAnalisadasDesde: vi.fn(async () => 0),
}));

import { completarJson, iaDisponivel } from "@/infra/llm";
import { normalizar } from "@/lib/normalizar";
import { buscarCandidatosReuso } from "@/modules/itens/itens.service";

import * as repository from "./requisicoes.repository";
import type { RequisicaoDetalhe } from "./requisicoes.repository";
import { requisicaoSchema } from "./requisicoes.schemas";
import { analisar, criar, encerrar, LIMITE_ANALISES_POR_DIA, obterRequisicao } from "./requisicoes.service";

const repo = vi.mocked(repository);
const buscar = vi.mocked(buscarCandidatosReuso);

const colaborador: UsuarioLogado = {
  id: "col",
  nome: "Colaborador",
  email: "col@manserv.com.br",
  papel: "colaborador",
  utId: "ut2",
  utsAdicionais: [],
  ativo: true,
  deveTrocarSenha: false,
};
const outro: UsuarioLogado = { ...colaborador, id: "outro" };
const almoxarifeDaUt: UsuarioLogado = { ...colaborador, id: "alm", papel: "almoxarife" };
const admin: UsuarioLogado = { ...colaborador, id: "adm", papel: "admin", utId: null };

function requisicao(parcial: Partial<RequisicaoDetalhe> = {}): RequisicaoDetalhe {
  return {
    id: "r1",
    numero: 7,
    solicitanteId: "col",
    utId: "ut2",
    justificativa: null,
    status: "rascunho",
    analisadaEm: null,
    analiseComIa: false,
    criadoEm: new Date("2026-10-22T12:00:00Z"),
    atualizadoEm: new Date("2026-10-22T12:00:00Z"),
    ut: { id: "ut2", nome: "UT 2", cidade: "Salvador", uf: "BA" },
    solicitante: { name: "Colaborador" },
    linhas: [
      { id: "l1", requisicaoId: "r1", ordem: 0, descricao: "Tomada 10A", quantidade: 3, unidade: "un", observacao: null, recomendacoes: [] },
      { id: "l2", requisicaoId: "r1", ordem: 1, descricao: "Notebook", quantidade: 1, unidade: "un", observacao: null, recomendacoes: [] },
    ],
    ...parcial,
  };
}

function candidato(id: string, texto: string, quantidadeDisponivel: number) {
  return {
    id,
    nome: texto,
    marca: "",
    modelo: "",
    descricao: null,
    estado: "novo",
    unidade: "un",
    quantidadeDisponivel,
    utNome: "UT 1",
    buscaNormalizada: normalizar(texto),
  };
}

const agora = new Date("2026-10-22T15:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(iaDisponivel).mockReturnValue(false);
  vi.mocked(completarJson).mockResolvedValue(null);
  repo.contarAnalisadasDesde.mockResolvedValue(0);
});

describe("criar", () => {
  const entrada = requisicaoSchema.parse({
    linhas: [{ descricao: "Tomada 10A", quantidade: "3", unidade: "un" }],
    abrir: false,
  });

  it("cria o rascunho na única UT do usuário", async () => {
    repo.criar.mockResolvedValue({ id: "r1" });
    await criar(colaborador, entrada, agora);
    expect(repo.criar).toHaveBeenCalledWith(
      expect.objectContaining({ solicitanteId: "col", utId: "ut2", status: "rascunho" }),
    );
    expect(repo.gravarAnalise).not.toHaveBeenCalled();
  });

  it("admin não abre requisição", async () => {
    await expect(criar(admin, entrada, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });

  it("não aceita UT a que o usuário não está vinculado", async () => {
    await expect(criar(colaborador, { ...entrada, utId: "ut9" }, agora)).rejects.toMatchObject({ codigo: "UT_INVALIDA" });
  });
});

describe("analisar", () => {
  it("abre o rascunho, exclui as UTs do usuário e aloca sem passar do disponível", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao());
    buscar.mockImplementation(async (consultas) =>
      consultas.some((c) => c.includes("tomada")) ? [candidato("t1", "Tomada 10A", 2)] : [],
    );

    await analisar(colaborador, { id: "r1" }, agora);

    expect(buscar).toHaveBeenCalledWith(expect.anything(), ["ut2"]);
    expect(repo.gravarAnalise).toHaveBeenCalledWith(
      "r1",
      {
        recomendacoes: [expect.objectContaining({ linhaId: "l1", itemId: "t1", quantidadeSugerida: 2, aderencia: "similar" })],
        analisadaEm: agora,
        analiseComIa: false,
        status: "aberta",
      },
      "tx",
    );
  });

  it("guarda todas as UTs que têm o item, mesmo depois de cobrir a quantidade", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao());
    buscar.mockImplementation(async (consultas) =>
      consultas.some((c) => c.includes("notebook"))
        ? [candidato("nbA", "Notebook corporativo", 4), candidato("nbB", "Notebook corporativo", 2)]
        : [],
    );

    await analisar(colaborador, { id: "r1" }, agora);

    const gravadas = repo.gravarAnalise.mock.calls[0][1].recomendacoes.filter((r) => r.linhaId === "l2");
    expect(gravadas.map((r) => [r.itemId, r.quantidadeSugerida])).toEqual([
      ["nbA", 1],
      ["nbB", 0],
    ]);
  });

  it("só quem abriu pode analisar", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao({ status: "aberta" }));
    await expect(analisar(almoxarifeDaUt, { id: "r1" }, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(analisar(outro, { id: "r1" }, agora)).rejects.toMatchObject({ codigo: "REQUISICAO_NAO_ENCONTRADA" });
  });

  it("não reanalisa logo em seguida", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao({ status: "aberta", analisadaEm: new Date(agora.getTime() - 10_000) }));
    await expect(analisar(colaborador, { id: "r1" }, agora)).rejects.toMatchObject({ codigo: "ANALISE_RECENTE" });
  });

  it("respeita o limite diário quando a IA está ligada", async () => {
    vi.mocked(iaDisponivel).mockReturnValue(true);
    repo.contarAnalisadasDesde.mockResolvedValue(LIMITE_ANALISES_POR_DIA);
    repo.buscarPorId.mockResolvedValue(requisicao({ status: "aberta" }));
    await expect(analisar(colaborador, { id: "r1" }, agora)).rejects.toMatchObject({ codigo: "LIMITE_ANALISES" });
  });

  it("não analisa requisição encerrada", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao({ status: "enviada_compra" }));
    await expect(analisar(colaborador, { id: "r1" }, agora)).rejects.toMatchObject({ codigo: "REQUISICAO_ENCERRADA" });
  });
});

describe("encerrar", () => {
  it("rascunho só pode ser cancelado", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao());
    await expect(encerrar(colaborador, { id: "r1", status: "parcial" })).rejects.toMatchObject({
      codigo: "REQUISICAO_NAO_ENCERRAVEL",
    });
    repo.mudarStatusSe.mockResolvedValue(true);
    await encerrar(colaborador, { id: "r1", status: "cancelada" });
    expect(repo.mudarStatusSe).toHaveBeenCalledWith("r1", ["rascunho", "aberta"], "cancelada");
  });

  it("aberta encerra como enviada para compra", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao({ status: "aberta" }));
    repo.mudarStatusSe.mockResolvedValue(true);
    await encerrar(colaborador, { id: "r1", status: "enviada_compra" });
    expect(repo.mudarStatusSe).toHaveBeenCalledWith("r1", ["aberta"], "enviada_compra");
  });
});

describe("obterRequisicao (visibilidade)", () => {
  it("o almoxarife da UT vê a requisição aberta, mas não o rascunho", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao({ status: "aberta" }));
    await expect(obterRequisicao(almoxarifeDaUt, "r1")).resolves.toMatchObject({ codigo: "REQ-000007" });

    repo.buscarPorId.mockResolvedValue(requisicao());
    await expect(obterRequisicao(almoxarifeDaUt, "r1")).rejects.toMatchObject({ codigo: "REQUISICAO_NAO_ENCONTRADA" });
  });

  it("outro colaborador não vê; admin vê sem ações", async () => {
    repo.buscarPorId.mockResolvedValue(requisicao({ status: "aberta" }));
    await expect(obterRequisicao(outro, "r1")).rejects.toMatchObject({ codigo: "REQUISICAO_NAO_ENCONTRADA" });
    await expect(obterRequisicao(admin, "r1")).resolves.toMatchObject({
      acoes: { editar: false, analisar: false, encerrar: false },
    });
  });

  it("calcula o que falta comprar por linha", async () => {
    const base = requisicao({ status: "aberta" });
    const item = {
      id: "t1",
      nome: "Tomada",
      marca: "X",
      modelo: "Y",
      rm: null,
      estado: "novo" as const,
      unidade: "un" as const,
      status: "disponivel" as const,
      quantidadeDisponivel: 2,
      ut: { id: "ut1", nome: "UT 1", cidade: "Recife", uf: "PE", ativo: true },
      fotos: [],
    };
    base.linhas[0].recomendacoes = [
      { id: "rec1", linhaId: "l1", itemId: "t1", quantidadeSugerida: 2, aderencia: "exata", justificativa: "ok", ordem: 0, item },
    ];
    repo.buscarPorId.mockResolvedValue(base);
    const dto = await obterRequisicao(colaborador, "r1");
    expect(dto.linhas.map((l) => [l.quantidadeReuso, l.quantidadeComprar])).toEqual([
      [2, 1],
      [0, 1],
    ]);
    expect(dto.linhas[0].recomendacoes[0].item).toMatchObject({ naVitrine: true, ut: { id: "ut1", nome: "UT 1" } });
  });
});
