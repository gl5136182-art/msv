import { Prisma } from "@/generated/prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("@/infra/db", () => ({ db: { $transaction: vi.fn() } }));
vi.mock("@/modules/notificacoes/notificacoes.service", () => ({ notificarEvento: vi.fn(async () => []) }));
vi.mock("@/infra/storage", () => ({
  obterUrls: vi.fn(async (chaves: string[]) => Object.fromEntries(chaves.map((c) => [c, `https://dl/${c}`]))),
}));
vi.mock("./solicitacoes.repository", () => ({
  buscarItemParaSolicitar: vi.fn(),
  criar: vi.fn(),
  buscarPorId: vi.fn(),
  aceitarSePendente: vi.fn(),
  recusarPendentesDoItem: vi.fn(),
  debitarQuantidade: vi.fn(),
  quantidadeDisponivelDoItem: vi.fn(),
  atualizarStatusDoItem: vi.fn(),
  recusarSePendente: vi.fn(),
  cancelarSeStatus: vi.fn(),
  concluirSeAceita: vi.fn(),
  cancelarPendentesDaUt: vi.fn(),
  listarEnviadasPelaUt: vi.fn(),
  listarRecebidasPelaUt: vi.fn(),
  devolverQuantidade: vi.fn(),
  atualizarTotalEStatusDoItem: vi.fn(),
}));

import { db } from "@/infra/db";
import { notificarEvento } from "@/modules/notificacoes/notificacoes.service";

import * as repository from "./solicitacoes.repository";
import type {
  ItemParaSolicitar,
  SolicitacaoComItem,
  SolicitacaoParaLista,
  SolicitacaoRegistro,
} from "./solicitacoes.repository";
import { concluirSchema, recusarSchema, solicitarSchema, type SolicitarEntrada } from "./solicitacoes.schemas";
import {
  aceitar,
  cancelar,
  cancelarPendentesDaUtDesativada,
  notificarCancelamentosDaUtDesativada,
  notificarRecusasDoItemArquivado,
  concluir,
  listarSolicitacoes,
  recusar,
  recusarPendentesDoItemArquivado,
  solicitar,
} from "./solicitacoes.service";

const repo = vi.mocked(repository);

// UT "ut2" pede itens da UT "ut1".
const colaborador: UsuarioLogado = {
  id: "col",
  nome: "Colaborador",
  email: "col@manserv.com.br",
  papel: "colaborador",
  utId: "ut2",
  ativo: true,
  deveTrocarSenha: false,
};
const almoxarifeOrigem: UsuarioLogado = { ...colaborador, id: "alm1", papel: "almoxarife", utId: "ut1" };
const almoxarifeDestino: UsuarioLogado = { ...colaborador, id: "alm2", papel: "almoxarife" };
const admin: UsuarioLogado = { ...colaborador, id: "adm", papel: "admin", utId: null };

function item(parcial: Partial<ItemParaSolicitar> = {}): ItemParaSolicitar {
  return {
    id: "item1",
    nome: "Furadeira",
    unidade: "un",
    utId: "ut1",
    status: "disponivel",
    quantidadeDisponivel: 5,
    ut: { ativo: true },
    ...parcial,
  };
}

function solicitacao(parcial: Partial<SolicitacaoRegistro> = {}): SolicitacaoRegistro {
  return {
    id: "sol1",
    itemId: "item1",
    solicitanteId: "col",
    utDestinoId: "ut2",
    quantidade: 2,
    observacao: null,
    status: "pendente",
    valorUnitarioSnapshot: null,
    motivoRecusa: null,
    custoFrete: new Prisma.Decimal(0),
    respondidaPorId: null,
    respondidaEm: null,
    concluidaPorId: null,
    concluidaEm: null,
    canceladaPorId: null,
    canceladaEm: null,
    criadoEm: new Date("2026-10-14T12:00:00Z"),
    ...parcial,
  };
}

function comItem(
  parcial: Partial<SolicitacaoRegistro> = {},
  itemParcial: Partial<SolicitacaoComItem["item"]> = {},
): SolicitacaoComItem {
  return {
    ...solicitacao(parcial),
    item: {
      id: "item1",
      nome: "Furadeira",
      utId: "ut1",
      status: "disponivel",
      quantidadeDisponivel: 5,
      quantidadeTotal: 5,
      valorUnitarioReposicao: new Prisma.Decimal("450.90"),
      ...itemParcial,
    },
  };
}

const entrada: SolicitarEntrada = { itemId: "item1", quantidade: 2, observacao: undefined };

beforeEach(() => {
  vi.resetAllMocks();
  repo.buscarItemParaSolicitar.mockResolvedValue(item());
  repo.criar.mockImplementation(async (dados) => solicitacao({ ...dados }));

  // Aceitar: `db.$transaction` executa o callback com um client fictício; o repository é mockado.
  vi.mocked(db.$transaction).mockImplementation((async (callback: (tx: unknown) => unknown) =>
    callback({})) as never);
  repo.buscarPorId.mockResolvedValue(comItem());
  repo.aceitarSePendente.mockResolvedValue(true);
  repo.debitarQuantidade.mockResolvedValue(true);
  repo.quantidadeDisponivelDoItem.mockResolvedValue(3);
  repo.recusarPendentesDoItem.mockResolvedValue([]);
  repo.recusarSePendente.mockResolvedValue(true);
  repo.cancelarSeStatus.mockResolvedValue(true);
  repo.concluirSeAceita.mockResolvedValue(true);
  repo.devolverQuantidade.mockResolvedValue({ quantidadeDisponivel: 5, quantidadeTotal: 5, status: "disponivel" });
});

describe("solicitar (SPEC §3, regras 5 e 6)", () => {
  it("cria a solicitação pendente com a UT de destino vinda da sessão", async () => {
    const resultado = await solicitar(colaborador, { ...entrada, observacao: "Para a obra X" });

    expect(repo.criar).toHaveBeenCalledWith({
      itemId: "item1",
      solicitanteId: "col",
      utDestinoId: "ut2",
      quantidade: 2,
      observacao: "Para a obra X",
      status: "pendente",
    });
    expect(resultado).toMatchObject({ status: "pendente", quantidade: 2, utDestinoId: "ut2" });
    expect(resultado.criadoEm).toBe("2026-10-14T12:00:00.000Z");
  });

  it("almoxarife de outra UT também pode solicitar", async () => {
    await expect(solicitar(almoxarifeDestino, entrada)).resolves.toMatchObject({ solicitanteId: "alm2" });
  });

  it("aceita a quantidade igual à disponível", async () => {
    await expect(solicitar(colaborador, { ...entrada, quantidade: 5 })).resolves.toMatchObject({ quantidade: 5 });
  });

  it("não debita nem altera o item (a disputa é resolvida ao aceitar)", async () => {
    await solicitar(colaborador, entrada);
    expect(repo.criar).toHaveBeenCalledTimes(1);
  });

  it("recusa item da própria UT", async () => {
    repo.buscarItemParaSolicitar.mockResolvedValue(item({ utId: "ut2" }));
    await expect(solicitar(colaborador, entrada)).rejects.toMatchObject({ codigo: "ITEM_DA_PROPRIA_UT" });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("recusa item de UT inativa", async () => {
    repo.buscarItemParaSolicitar.mockResolvedValue(item({ ut: { ativo: false } }));
    await expect(solicitar(colaborador, entrada)).rejects.toMatchObject({ codigo: "UT_INATIVA" });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it.each(["esgotado", "arquivado"] as const)("recusa item %s", async (status) => {
    repo.buscarItemParaSolicitar.mockResolvedValue(item({ status, quantidadeDisponivel: 0 }));
    await expect(solicitar(colaborador, entrada)).rejects.toMatchObject({ codigo: "ITEM_INDISPONIVEL" });
  });

  it("recusa quantidade acima da disponível, informando quanto há", async () => {
    await expect(solicitar(colaborador, { ...entrada, quantidade: 6 })).rejects.toMatchObject({
      codigo: "QUANTIDADE_INDISPONIVEL",
      message: expect.stringContaining("5"),
    });
    expect(repo.criar).not.toHaveBeenCalled();
  });

  it("recusa item inexistente", async () => {
    repo.buscarItemParaSolicitar.mockResolvedValue(null);
    await expect(solicitar(colaborador, entrada)).rejects.toMatchObject({ codigo: "ITEM_NAO_ENCONTRADO" });
  });

  it("admin não solicita", async () => {
    await expect(solicitar(admin, entrada)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.buscarItemParaSolicitar).not.toHaveBeenCalled();
  });

  it("usuário inativo não solicita", async () => {
    await expect(solicitar({ ...colaborador, ativo: false }, entrada)).rejects.toMatchObject({
      codigo: "USUARIO_INATIVO",
    });
  });

  it("usuário sem UT não solicita", async () => {
    await expect(solicitar({ ...colaborador, utId: null }, entrada)).rejects.toMatchObject({ codigo: "SEM_UT" });
  });
});

describe("solicitarSchema", () => {
  it("lê a quantidade digitada e apara a observação", () => {
    const dados = solicitarSchema.parse({ itemId: "item1", quantidade: "3", observacao: "  Urgente  " });
    expect(dados).toEqual({ itemId: "item1", quantidade: 3, observacao: "Urgente" });
  });

  it("observação vazia vira indefinida", () => {
    expect(solicitarSchema.parse({ itemId: "item1", quantidade: 1, observacao: "   " }).observacao).toBeUndefined();
  });

  it.each([0, -1, 1.5, "", "abc"])("rejeita quantidade %s", (quantidade) => {
    expect(solicitarSchema.safeParse({ itemId: "item1", quantidade }).success).toBe(false);
  });

  it("rejeita observação acima de 500 caracteres", () => {
    expect(solicitarSchema.safeParse({ itemId: "item1", quantidade: 1, observacao: "a".repeat(501) }).success).toBe(
      false,
    );
  });
});

describe("aceitar (SPEC §3, regras 7 e 8)", () => {
  const agora = new Date("2026-10-14T15:00:00Z");

  it("aceita, debita a quantidade e grava o valor de reposição do momento", async () => {
    repo.buscarPorId.mockResolvedValueOnce(comItem()).mockResolvedValueOnce(comItem({ status: "aceita" }));

    const resultado = await aceitar(almoxarifeOrigem, { id: "sol1" }, agora);

    expect(repo.aceitarSePendente).toHaveBeenCalledWith(
      "sol1",
      { respondidaPorId: "alm1", respondidaEm: agora, valorUnitarioSnapshot: 450.9 },
      expect.anything(),
    );
    expect(repo.debitarQuantidade).toHaveBeenCalledWith("item1", 2, expect.anything());
    expect(resultado.status).toBe("aceita");
  });

  it("não esgota nem recusa as outras pendentes enquanto sobra quantidade", async () => {
    repo.quantidadeDisponivelDoItem.mockResolvedValue(3);

    await aceitar(almoxarifeOrigem, { id: "sol1" }, agora);

    expect(repo.atualizarStatusDoItem).not.toHaveBeenCalled();
    expect(repo.recusarPendentesDoItem).not.toHaveBeenCalled();
  });

  it("esgota o item e recusa automaticamente as pendentes restantes", async () => {
    repo.quantidadeDisponivelDoItem.mockResolvedValue(0);

    await aceitar(almoxarifeOrigem, { id: "sol1" }, agora);

    expect(repo.atualizarStatusDoItem).toHaveBeenCalledWith("item1", "esgotado", expect.anything());
    expect(repo.recusarPendentesDoItem).toHaveBeenCalledWith("item1", "Item esgotado", agora, "sol1", expect.anything());
  });

  it("falha com 'Quantidade não está mais disponível' quando o débito condicional não passa", async () => {
    repo.debitarQuantidade.mockResolvedValue(false);

    await expect(aceitar(almoxarifeOrigem, { id: "sol1" }, agora)).rejects.toMatchObject({
      codigo: "QUANTIDADE_INDISPONIVEL",
      message: "Quantidade não está mais disponível",
    });
    // O erro dentro da transação a desfaz: nada de esgotar ou recusar depois.
    expect(repo.atualizarStatusDoItem).not.toHaveBeenCalled();
    expect(repo.recusarPendentesDoItem).not.toHaveBeenCalled();
  });

  it("duas aceitações disputando a mesma quantidade: a segunda perde", async () => {
    // O item tem 2 unidades e duas pendentes de 2. O update condicional deixa passar só a primeira.
    repo.debitarQuantidade.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    repo.quantidadeDisponivelDoItem.mockResolvedValue(0);
    repo.buscarPorId
      .mockResolvedValueOnce(comItem({ id: "solA" }, { quantidadeDisponivel: 2 }))
      .mockResolvedValueOnce(comItem({ id: "solA", status: "aceita" }, { quantidadeDisponivel: 0 }))
      .mockResolvedValueOnce(comItem({ id: "solB" }, { quantidadeDisponivel: 2 }));

    await expect(aceitar(almoxarifeOrigem, { id: "solA" }, agora)).resolves.toMatchObject({ status: "aceita" });
    await expect(aceitar(almoxarifeOrigem, { id: "solB" }, agora)).rejects.toMatchObject({
      codigo: "QUANTIDADE_INDISPONIVEL",
    });
  });

  it("não aceita quando outra resposta chegou primeiro (update condicional na solicitação)", async () => {
    repo.aceitarSePendente.mockResolvedValue(false);

    await expect(aceitar(almoxarifeOrigem, { id: "sol1" }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_PENDENTE",
    });
    expect(repo.debitarQuantidade).not.toHaveBeenCalled();
  });

  it.each(["aceita", "recusada", "cancelada", "concluida"] as const)("não aceita solicitação %s", async (status) => {
    repo.buscarPorId.mockResolvedValue(comItem({ status }));

    await expect(aceitar(almoxarifeOrigem, { id: "sol1" }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_PENDENTE",
    });
    expect(repo.aceitarSePendente).not.toHaveBeenCalled();
  });

  it("só o almoxarife da UT de origem aceita", async () => {
    await expect(aceitar(almoxarifeDestino, { id: "sol1" }, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(aceitar(colaborador, { id: "sol1" }, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    await expect(aceitar(admin, { id: "sol1" }, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.aceitarSePendente).not.toHaveBeenCalled();
  });

  it("solicitação inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(aceitar(almoxarifeOrigem, { id: "x" }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_ENCONTRADA",
    });
  });
});

describe("recusar (SPEC §3, regra 7)", () => {
  const agora = new Date("2026-10-14T15:00:00Z");

  it("recusa com o motivo, registrando quem respondeu e quando", async () => {
    const resultado = await recusar(almoxarifeOrigem, { id: "sol1", motivo: "  Peça reservada  " }, agora);

    expect(repo.recusarSePendente).toHaveBeenCalledWith("sol1", {
      motivoRecusa: "Peça reservada",
      respondidaPorId: "alm1",
      respondidaEm: agora,
    });
    expect(resultado).toMatchObject({ status: "recusada" });
  });

  it("não debita nem mexe no item", async () => {
    await recusar(almoxarifeOrigem, { id: "sol1", motivo: "Sem condição de envio" }, agora);

    expect(repo.debitarQuantidade).not.toHaveBeenCalled();
    expect(repo.atualizarStatusDoItem).not.toHaveBeenCalled();
  });

  it("exige o motivo", async () => {
    await expect(recusar(almoxarifeOrigem, { id: "sol1", motivo: "   " }, agora)).rejects.toMatchObject({
      codigo: "MOTIVO_OBRIGATORIO",
    });
    expect(repo.recusarSePendente).not.toHaveBeenCalled();
  });

  it.each(["aceita", "recusada", "cancelada", "concluida"] as const)("não recusa solicitação %s", async (status) => {
    repo.buscarPorId.mockResolvedValue(comItem({ status }));

    await expect(recusar(almoxarifeOrigem, { id: "sol1", motivo: "x" }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_PENDENTE",
    });
  });

  it("falha se outra resposta chegou primeiro (update condicional)", async () => {
    repo.recusarSePendente.mockResolvedValue(false);

    await expect(recusar(almoxarifeOrigem, { id: "sol1", motivo: "x" }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_PENDENTE",
    });
  });

  it("só o almoxarife da UT de origem recusa", async () => {
    for (const usuario of [almoxarifeDestino, colaborador, admin]) {
      await expect(recusar(usuario, { id: "sol1", motivo: "x" }, agora)).rejects.toMatchObject({
        codigo: "SEM_PERMISSAO",
      });
    }
    expect(repo.recusarSePendente).not.toHaveBeenCalled();
  });
});

describe("recusarSchema", () => {
  it("apara o motivo", () => {
    expect(recusarSchema.parse({ id: "sol1", motivo: "  Quebrado " })).toEqual({ id: "sol1", motivo: "Quebrado" });
  });

  it.each(["", "   ", undefined])("rejeita motivo %j", (motivo) => {
    expect(recusarSchema.safeParse({ id: "sol1", motivo }).success).toBe(false);
  });

  it("rejeita motivo acima de 500 caracteres", () => {
    expect(recusarSchema.safeParse({ id: "sol1", motivo: "a".repeat(501) }).success).toBe(false);
  });
});

describe("cancelar (SPEC §3, regra 9)", () => {
  const agora = new Date("2026-10-14T15:00:00Z");
  const aceita = () => comItem({ status: "aceita", quantidade: 2 });

  it("o solicitante cancela a pendente, sem mexer na quantidade do item", async () => {
    const resultado = await cancelar(colaborador, { id: "sol1" }, agora);

    expect(repo.cancelarSeStatus).toHaveBeenCalledWith(
      "sol1",
      "pendente",
      { canceladaPorId: "col", canceladaEm: agora },
      expect.anything(),
    );
    expect(repo.devolverQuantidade).not.toHaveBeenCalled();
    expect(resultado.status).toBe("cancelada");
  });

  it("o solicitante cancela a aceita e a quantidade volta ao item", async () => {
    repo.buscarPorId.mockResolvedValue(aceita());
    repo.devolverQuantidade.mockResolvedValue({ quantidadeDisponivel: 5, quantidadeTotal: 5, status: "disponivel" });

    await cancelar(colaborador, { id: "sol1" }, agora);

    expect(repo.cancelarSeStatus).toHaveBeenCalledWith("sol1", "aceita", expect.anything(), expect.anything());
    expect(repo.devolverQuantidade).toHaveBeenCalledWith("item1", 2, expect.anything());
    expect(repo.atualizarTotalEStatusDoItem).not.toHaveBeenCalled();
  });

  it("o almoxarife de origem cancela a aceita", async () => {
    repo.buscarPorId.mockResolvedValue(aceita());

    await expect(cancelar(almoxarifeOrigem, { id: "sol1" }, agora)).resolves.toMatchObject({ status: "cancelada" });
    expect(repo.devolverQuantidade).toHaveBeenCalledTimes(1);
  });

  it("o item esgotado volta a disponivel quando a quantidade é devolvida (regra 3)", async () => {
    repo.buscarPorId.mockResolvedValue(aceita());
    repo.devolverQuantidade.mockResolvedValue({ quantidadeDisponivel: 2, quantidadeTotal: 5, status: "esgotado" });

    await cancelar(colaborador, { id: "sol1" }, agora);

    expect(repo.atualizarTotalEStatusDoItem).toHaveBeenCalledWith(
      "item1",
      { quantidadeTotal: 5, status: "disponivel" },
      expect.anything(),
    );
  });

  it("item arquivado continua arquivado ao receber a quantidade", async () => {
    repo.buscarPorId.mockResolvedValue(aceita());
    repo.devolverQuantidade.mockResolvedValue({ quantidadeDisponivel: 2, quantidadeTotal: 5, status: "arquivado" });

    await cancelar(colaborador, { id: "sol1" }, agora);

    expect(repo.atualizarTotalEStatusDoItem).not.toHaveBeenCalled();
  });

  it("sobe o total quando a quantidade devolvida passa dele (ajuste manual anterior)", async () => {
    repo.buscarPorId.mockResolvedValue(aceita());
    repo.devolverQuantidade.mockResolvedValue({ quantidadeDisponivel: 7, quantidadeTotal: 5, status: "disponivel" });

    await cancelar(colaborador, { id: "sol1" }, agora);

    expect(repo.atualizarTotalEStatusDoItem).toHaveBeenCalledWith(
      "item1",
      { quantidadeTotal: 7, status: "disponivel" },
      expect.anything(),
    );
  });

  it("o almoxarife de origem não cancela a pendente (deve recusar)", async () => {
    await expect(cancelar(almoxarifeOrigem, { id: "sol1" }, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.cancelarSeStatus).not.toHaveBeenCalled();
  });

  it("quem não é o solicitante nem almoxarife de origem não cancela", async () => {
    const outroColaborador: UsuarioLogado = { ...colaborador, id: "col2" };
    for (const usuario of [outroColaborador, almoxarifeDestino]) {
      repo.buscarPorId.mockResolvedValue(aceita());
      await expect(cancelar(usuario, { id: "sol1" }, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    }
    await expect(cancelar(admin, { id: "sol1" }, agora)).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
    expect(repo.cancelarSeStatus).not.toHaveBeenCalled();
  });

  it.each(["recusada", "cancelada", "concluida"] as const)("não cancela solicitação %s", async (status) => {
    repo.buscarPorId.mockResolvedValue(comItem({ status }));

    await expect(cancelar(colaborador, { id: "sol1" }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_CANCELAVEL",
    });
    expect(repo.devolverQuantidade).not.toHaveBeenCalled();
  });

  it("falha se a solicitação mudou de status no meio (update condicional) e não devolve quantidade", async () => {
    repo.buscarPorId.mockResolvedValue(aceita());
    repo.cancelarSeStatus.mockResolvedValue(false);

    await expect(cancelar(colaborador, { id: "sol1" }, agora)).rejects.toMatchObject({ codigo: "SOLICITACAO_MUDOU" });
    expect(repo.devolverQuantidade).not.toHaveBeenCalled();
  });

  it("solicitação inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(cancelar(colaborador, { id: "x" }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_ENCONTRADA",
    });
  });
});

describe("concluir (SPEC §3, regras 10 e 11)", () => {
  const agora = new Date("2026-10-14T15:00:00Z");
  const aceita = () => comItem({ status: "aceita" });

  beforeEach(() => {
    repo.buscarPorId.mockResolvedValue(aceita());
  });

  it("o solicitante conclui e grava o custo do frete", async () => {
    const resultado = await concluir(colaborador, { id: "sol1", custoFrete: 187.5 }, agora);

    expect(repo.concluirSeAceita).toHaveBeenCalledWith("sol1", {
      custoFrete: 187.5,
      concluidaPorId: "col",
      concluidaEm: agora,
    });
    expect(resultado.status).toBe("concluida");
  });

  it("um almoxarife da UT de destino conclui", async () => {
    await expect(concluir(almoxarifeDestino, { id: "sol1", custoFrete: 0 }, agora)).resolves.toMatchObject({
      status: "concluida",
    });
  });

  it("não mexe na quantidade do item (já foi debitada ao aceitar)", async () => {
    await concluir(colaborador, { id: "sol1", custoFrete: 0 }, agora);

    expect(repo.debitarQuantidade).not.toHaveBeenCalled();
    expect(repo.devolverQuantidade).not.toHaveBeenCalled();
  });

  it("o almoxarife da UT de origem não confirma o recebimento", async () => {
    await expect(concluir(almoxarifeOrigem, { id: "sol1", custoFrete: 0 }, agora)).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
    expect(repo.concluirSeAceita).not.toHaveBeenCalled();
  });

  it("outro colaborador da UT de destino não conclui", async () => {
    const outro: UsuarioLogado = { ...colaborador, id: "col2" };
    await expect(concluir(outro, { id: "sol1", custoFrete: 0 }, agora)).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
  });

  it("admin não conclui", async () => {
    await expect(concluir(admin, { id: "sol1", custoFrete: 0 }, agora)).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });
  });

  it.each(["pendente", "recusada", "cancelada", "concluida"] as const)(
    "só conclui solicitação aceita (%s é recusada)",
    async (status) => {
      repo.buscarPorId.mockResolvedValue(comItem({ status }));

      await expect(concluir(colaborador, { id: "sol1", custoFrete: 0 }, agora)).rejects.toMatchObject({
        codigo: "SOLICITACAO_NAO_ACEITA",
      });
      expect(repo.concluirSeAceita).not.toHaveBeenCalled();
    },
  );

  it("falha se a solicitação mudou de status no meio (update condicional)", async () => {
    repo.concluirSeAceita.mockResolvedValue(false);

    await expect(concluir(colaborador, { id: "sol1", custoFrete: 0 }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_MUDOU",
    });
  });

  it("solicitação inexistente", async () => {
    repo.buscarPorId.mockResolvedValue(null);
    await expect(concluir(colaborador, { id: "x", custoFrete: 0 }, agora)).rejects.toMatchObject({
      codigo: "SOLICITACAO_NAO_ENCONTRADA",
    });
  });
});

describe("concluirSchema", () => {
  it.each([
    [undefined, 0],
    ["", 0],
    ["   ", 0],
    ["R$ 0,00", 0],
    ["R$ 187,50", 187.5],
    ["R$ 1.234,56", 1234.56],
    [150, 150],
    [0, 0],
  ])("frete %j vira %s", (custoFrete, esperado) => {
    expect(concluirSchema.parse({ id: "sol1", custoFrete }).custoFrete).toBe(esperado);
  });

  it("rejeita frete negativo, texto sem número e valor absurdo", () => {
    expect(concluirSchema.safeParse({ id: "sol1", custoFrete: -1 }).success).toBe(false);
    expect(concluirSchema.safeParse({ id: "sol1", custoFrete: "abc" }).success).toBe(false);
    expect(concluirSchema.safeParse({ id: "sol1", custoFrete: 1_000_000_000 }).success).toBe(false);
  });
});

describe("regras automáticas (regras 4 e 13)", () => {
  const agora = new Date("2026-10-14T15:00:00Z");

  it("item arquivado: recusa as pendentes com o motivo 'Item retirado da vitrine', sem autor", async () => {
    repo.recusarPendentesDoItem.mockResolvedValue([{ id: "s1", solicitanteId: "col" }]);
    const tx = { tx: true };

    const recusadas = await recusarPendentesDoItemArquivado("item1", tx as never, agora);

    expect(repo.recusarPendentesDoItem).toHaveBeenCalledWith("item1", "Item retirado da vitrine", agora, null, tx);
    expect(recusadas).toEqual([{ id: "s1", solicitanteId: "col" }]);
  });

  it("UT desativada: cancela as pendentes em que ela é origem ou destino", async () => {
    repo.cancelarPendentesDaUt.mockResolvedValue([{ id: "s1", solicitanteId: "col", itemNome: "Furadeira" }]);
    const tx = { tx: true };

    const canceladas = await cancelarPendentesDaUtDesativada("ut1", tx as never, agora);

    expect(repo.cancelarPendentesDaUt).toHaveBeenCalledWith("ut1", agora, tx);
    expect(canceladas).toHaveLength(1);
  });

  it("avisa os solicitantes das pendentes recusadas por arquivamento", async () => {
    await notificarRecusasDoItemArquivado("Furadeira", [
      { id: "s1", solicitanteId: "col" },
      { id: "s2", solicitanteId: "col2" },
    ]);

    expect(notificarEvento).toHaveBeenCalledTimes(2);
    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "recusada",
      itemNome: "Furadeira",
      solicitanteId: "col2",
      motivo: "Item retirado da vitrine",
    });
  });

  it("avisa os solicitantes das pendentes canceladas pela desativação da UT", async () => {
    await notificarCancelamentosDaUtDesativada([{ id: "s1", solicitanteId: "col", itemNome: "Furadeira" }]);

    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "cancelada_automaticamente",
      itemNome: "Furadeira",
      solicitanteId: "col",
    });
  });
});

describe("notificações das ações (SPEC §6.4)", () => {
  const agora = new Date("2026-10-14T15:00:00Z");

  it("solicitar avisa os almoxarifes da UT de origem", async () => {
    await solicitar(colaborador, { itemId: "item1", quantidade: 2, observacao: undefined });

    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "nova",
      itemNome: "Furadeira",
      quantidade: 2,
      unidade: "un",
      solicitanteId: "col",
      solicitanteNome: "Colaborador",
      utOrigemId: "ut1",
    });
  });

  it("aceitar avisa o solicitante", async () => {
    await aceitar(almoxarifeOrigem, { id: "sol1" }, agora);

    expect(notificarEvento).toHaveBeenCalledTimes(1);
    expect(notificarEvento).toHaveBeenCalledWith({ evento: "aceita", itemNome: "Furadeira", solicitanteId: "col" });
  });

  it("aceitar que esgota o item avisa também os solicitantes recusados automaticamente", async () => {
    repo.quantidadeDisponivelDoItem.mockResolvedValue(0);
    repo.recusarPendentesDoItem.mockResolvedValue([{ id: "s2", solicitanteId: "col2" }]);

    await aceitar(almoxarifeOrigem, { id: "sol1" }, agora);

    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "recusada",
      itemNome: "Furadeira",
      solicitanteId: "col2",
      motivo: "Item esgotado",
    });
  });

  it("aceitar que falha não notifica ninguém", async () => {
    repo.debitarQuantidade.mockResolvedValue(false);

    await aceitar(almoxarifeOrigem, { id: "sol1" }, agora).catch(() => undefined);

    expect(notificarEvento).not.toHaveBeenCalled();
  });

  it("recusar avisa o solicitante com o motivo", async () => {
    await recusar(almoxarifeOrigem, { id: "sol1", motivo: "Item reservado" }, agora);

    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "recusada",
      itemNome: "Furadeira",
      solicitanteId: "col",
      motivo: "Item reservado",
    });
  });

  it("cancelar pelo solicitante avisa a origem", async () => {
    await cancelar(colaborador, { id: "sol1" }, agora);

    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "cancelada_pelo_solicitante",
      itemNome: "Furadeira",
      solicitanteId: "col",
      solicitanteNome: "Colaborador",
      utOrigemId: "ut1",
    });
  });

  it("cancelar pelo almoxarife de origem avisa o solicitante", async () => {
    repo.buscarPorId.mockResolvedValue(comItem({ status: "aceita" }));

    await cancelar(almoxarifeOrigem, { id: "sol1" }, agora);

    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "cancelada_pela_origem",
      itemNome: "Furadeira",
      solicitanteId: "col",
    });
  });

  it("concluir avisa a origem", async () => {
    repo.buscarPorId.mockResolvedValue(comItem({ status: "aceita" }));

    await concluir(colaborador, { id: "sol1", custoFrete: 0 }, agora);

    expect(notificarEvento).toHaveBeenCalledWith({
      evento: "concluida",
      itemNome: "Furadeira",
      atorId: "col",
      atorNome: "Colaborador",
      utOrigemId: "ut1",
    });
  });
});

describe("listarSolicitacoes (SPEC §6.4)", () => {
  function paraLista(parcial: Partial<SolicitacaoParaLista> = {}): SolicitacaoParaLista {
    return {
      ...solicitacao(),
      item: {
        id: "item1",
        nome: "Furadeira",
        marca: "Bosch",
        modelo: "GSB 550",
        rm: "123456",
        unidade: "un",
        utId: "ut1",
        valorUnitarioReposicao: new Prisma.Decimal("450.90"),
        ut: { id: "ut1", nome: "BASE OPERACIONAL", cidade: "Uberaba", uf: "MG" },
        fotos: [{ chaveThumb: "fotos/2026/10/a_thumb.jpg" }],
      },
      utDestino: { id: "ut2", nome: "YARA CUB1", cidade: "Cubatão", uf: "SP" },
      solicitante: { id: "col", name: "Maria", email: "maria@manserv.com.br", telefone: "11999990000" },
      respondidaPor: null,
      ...parcial,
    };
  }

  it("minhas: busca pela UT do usuário e devolve as ações dele", async () => {
    repo.listarEnviadasPelaUt.mockResolvedValue([paraLista()]);

    const lista = await listarSolicitacoes(colaborador, "minhas");

    expect(repo.listarEnviadasPelaUt).toHaveBeenCalledWith("ut2");
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      status: "pendente",
      valorUnitario: 450.9,
      custoFrete: null,
      contatos: null,
      acoes: { aceitar: false, recusar: false, cancelar: true, concluir: false },
    });
    expect(lista[0].item.urlMiniatura).toBe("https://dl/fotos/2026/10/a_thumb.jpg");
  });

  it("recebidas: só almoxarife; o almoxarife de origem pode aceitar e recusar", async () => {
    repo.listarRecebidasPelaUt.mockResolvedValue([paraLista()]);

    const lista = await listarSolicitacoes(almoxarifeOrigem, "recebidas");

    expect(repo.listarRecebidasPelaUt).toHaveBeenCalledWith("ut1");
    expect(lista[0].acoes).toMatchObject({ aceitar: true, recusar: true, cancelar: false });
    await expect(listarSolicitacoes(colaborador, "recebidas")).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });

  it("aceita: usa o valor gravado ao aceitar e mostra os contatos de origem e destino", async () => {
    repo.listarEnviadasPelaUt.mockResolvedValue([
      paraLista({
        status: "aceita",
        valorUnitarioSnapshot: new Prisma.Decimal("400"),
        respondidaPorId: "alm1",
        respondidaPor: { name: "Carlos", email: "carlos@manserv.com.br", telefone: null },
      }),
    ]);

    const [linha] = await listarSolicitacoes(colaborador, "minhas");

    expect(linha.valorUnitario).toBe(400);
    expect(linha.contatos).toEqual({
      origem: { nome: "Carlos", email: "carlos@manserv.com.br", telefone: null },
      destino: { nome: "Maria", email: "maria@manserv.com.br", telefone: "11999990000" },
    });
  });

  it("os contatos só aparecem enquanto a solicitação está aceita", async () => {
    repo.listarEnviadasPelaUt.mockResolvedValue([
      paraLista({ id: "a", status: "concluida" }),
      paraLista({ id: "b", status: "cancelada" }),
      paraLista({ id: "c", status: "recusada" }),
    ]);

    const lista = await listarSolicitacoes(colaborador, "minhas");

    expect(lista.map((s) => s.contatos)).toEqual([null, null, null]);
  });

  it("concluída: informa o custo do frete", async () => {
    repo.listarEnviadasPelaUt.mockResolvedValue([
      paraLista({ status: "concluida", custoFrete: new Prisma.Decimal("120.5") }),
    ]);

    const [linha] = await listarSolicitacoes(colaborador, "minhas");

    expect(linha.custoFrete).toBe(120.5);
  });

  it("pendentes primeiro, mantendo a ordem de cada grupo", async () => {
    repo.listarEnviadasPelaUt.mockResolvedValue([
      paraLista({ id: "c1", status: "concluida" }),
      paraLista({ id: "p1", status: "pendente" }),
      paraLista({ id: "r1", status: "recusada" }),
      paraLista({ id: "p2", status: "pendente" }),
    ]);

    const lista = await listarSolicitacoes(colaborador, "minhas");

    expect(lista.map((s) => s.id)).toEqual(["p1", "p2", "c1", "r1"]);
  });

  it("usuário sem UT recebe lista vazia sem consultar o banco", async () => {
    await expect(listarSolicitacoes({ ...colaborador, utId: null }, "minhas")).resolves.toEqual([]);
    expect(repo.listarEnviadasPelaUt).not.toHaveBeenCalled();
  });

  it("admin não lista", async () => {
    await expect(listarSolicitacoes(admin, "minhas")).rejects.toMatchObject({ codigo: "SEM_PERMISSAO" });
  });
});
