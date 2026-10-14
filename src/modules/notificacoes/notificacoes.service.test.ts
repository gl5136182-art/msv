import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsuarioLogado } from "@/lib/usuario-logado";

vi.mock("@/infra/email", () => ({ enviarEmail: vi.fn(async () => true) }));
vi.mock("./notificacoes.repository", () => ({
  criarVarias: vi.fn(),
  listarDoUsuario: vi.fn(),
  contarNaoLidas: vi.fn(),
  marcarLida: vi.fn(),
  marcarTodasLidas: vi.fn(),
  listarAlmoxarifesAtivosDaUt: vi.fn(),
  buscarUsuariosAtivos: vi.fn(),
}));

import { enviarEmail } from "@/infra/email";

import { LIMITE_MENSAGEM, montarEmail, textoDoEvento } from "./notificacoes.mensagens";
import * as repository from "./notificacoes.repository";
import type { NotificacaoRegistro } from "./notificacoes.repository";
import { listarNotificacoes, marcarComoLida, marcarTodasComoLidas, notificarEvento } from "./notificacoes.service";

const repo = vi.mocked(repository);

const colaborador: UsuarioLogado = {
  id: "col",
  nome: "Maria",
  email: "maria@manserv.com.br",
  papel: "colaborador",
  utId: "ut2",
  ativo: true,
  deveTrocarSenha: false,
};

const almoxarifes = [
  { id: "alm1", name: "Carlos", email: "carlos@manserv.com.br" },
  { id: "alm3", name: "Ana", email: "ana@manserv.com.br" },
];

beforeEach(() => {
  vi.resetAllMocks();
  repo.listarAlmoxarifesAtivosDaUt.mockResolvedValue(almoxarifes);
  repo.buscarUsuariosAtivos.mockResolvedValue([{ id: "col", name: "Maria", email: "maria@manserv.com.br" }]);
  repo.criarVarias.mockResolvedValue(undefined);
});

describe("notificarEvento (SPEC §6.4)", () => {
  it("nova solicitação: avisa todos os almoxarifes da UT de origem", async () => {
    const criadas = await notificarEvento({
      evento: "nova",
      itemNome: "Furadeira",
      quantidade: 2,
      unidade: "un",
      solicitanteId: "col",
      solicitanteNome: "Maria",
      utOrigemId: "ut1",
    });

    expect(repo.listarAlmoxarifesAtivosDaUt).toHaveBeenCalledWith("ut1");
    expect(repo.criarVarias).toHaveBeenCalledWith([
      expect.objectContaining({ usuarioId: "alm1", tipo: "solicitacao_nova", link: "/solicitacoes?aba=recebidas" }),
      expect.objectContaining({ usuarioId: "alm3", tipo: "solicitacao_nova" }),
    ]);
    expect(criadas.map((c) => c.email)).toEqual(["carlos@manserv.com.br", "ana@manserv.com.br"]);
    expect(criadas[0].mensagem).toBe("Nova solicitação: Maria pediu 2 un de Furadeira.");
  });

  it.each(["aceita", "cancelada_pela_origem", "cancelada_automaticamente"] as const)(
    "%s: avisa o solicitante, em Minhas",
    async (evento) => {
      const criadas = await notificarEvento({ evento, itemNome: "Furadeira", solicitanteId: "col" });

      expect(repo.buscarUsuariosAtivos).toHaveBeenCalledWith(["col"]);
      expect(criadas).toHaveLength(1);
      expect(criadas[0]).toMatchObject({ usuarioId: "col", link: "/solicitacoes" });
    },
  );

  it("recusada: o solicitante recebe o motivo", async () => {
    const criadas = await notificarEvento({
      evento: "recusada",
      itemNome: "Furadeira",
      solicitanteId: "col",
      motivo: "Item reservado",
    });

    expect(criadas[0]).toMatchObject({ tipo: "solicitacao_recusada" });
    expect(criadas[0].mensagem).toContain("Item reservado");
  });

  it("cancelada pelo solicitante e concluída: avisam os almoxarifes da origem", async () => {
    const cancelada = await notificarEvento({
      evento: "cancelada_pelo_solicitante",
      itemNome: "Furadeira",
      solicitanteId: "col",
      solicitanteNome: "Maria",
      utOrigemId: "ut1",
    });
    const concluida = await notificarEvento({
      evento: "concluida",
      itemNome: "Furadeira",
      atorId: "col",
      atorNome: "Maria",
      utOrigemId: "ut1",
    });

    expect(cancelada.map((c) => c.usuarioId)).toEqual(["alm1", "alm3"]);
    expect(cancelada[0]).toMatchObject({ tipo: "solicitacao_cancelada" });
    expect(concluida.map((c) => c.usuarioId)).toEqual(["alm1", "alm3"]);
    expect(concluida[0]).toMatchObject({ tipo: "solicitacao_concluida" });
  });

  it("quem fez a ação não recebe a própria notificação", async () => {
    repo.listarAlmoxarifesAtivosDaUt.mockResolvedValue([...almoxarifes, { id: "col", name: "Maria", email: "m@m.br" }]);

    const criadas = await notificarEvento({
      evento: "concluida",
      itemNome: "Furadeira",
      atorId: "col",
      atorNome: "Maria",
      utOrigemId: "ut1",
    });

    expect(criadas.map((c) => c.usuarioId)).toEqual(["alm1", "alm3"]);
  });

  it("sem destinatários não grava nada", async () => {
    repo.buscarUsuariosAtivos.mockResolvedValue([]);

    await expect(notificarEvento({ evento: "aceita", itemNome: "Furadeira", solicitanteId: "col" })).resolves.toEqual([]);
    expect(repo.criarVarias).not.toHaveBeenCalled();
  });

  it("nunca lança: falha ao gravar vira lista vazia e a ação segue valendo", async () => {
    repo.criarVarias.mockRejectedValue(new Error("banco fora do ar"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(notificarEvento({ evento: "aceita", itemNome: "Furadeira", solicitanteId: "col" })).resolves.toEqual([]);
    expect(erro).toHaveBeenCalled();
    erro.mockRestore();
  });
});

describe("e-mail opcional (SPEC §6.4)", () => {
  const eventoNova = {
    evento: "nova",
    itemNome: "Furadeira",
    quantidade: 2,
    unidade: "un",
    solicitanteId: "col",
    solicitanteNome: "Maria",
    utOrigemId: "ut1",
  } as const;

  it("envia o mesmo evento por e-mail a cada destinatário", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://msv.exemplo.com.br/");

    await notificarEvento(eventoNova);

    expect(enviarEmail).toHaveBeenCalledTimes(2);
    expect(enviarEmail).toHaveBeenCalledWith({
      para: "carlos@manserv.com.br",
      assunto: "MSV: nova solicitação para um item da sua UT",
      texto:
        "Nova solicitação: Maria pediu 2 un de Furadeira.\n\nAbra no MSV: https://msv.exemplo.com.br/solicitacoes?aba=recebidas",
    });
    vi.unstubAllEnvs();
  });

  it("a notificação in-app é gravada antes do e-mail, mesmo que o envio demore ou falhe", async () => {
    vi.mocked(enviarEmail).mockResolvedValue(false);

    const criadas = await notificarEvento(eventoNova);

    expect(repo.criarVarias).toHaveBeenCalledTimes(1);
    expect(criadas).toHaveLength(2);
  });

  it("sem destinatários não envia e-mail", async () => {
    repo.listarAlmoxarifesAtivosDaUt.mockResolvedValue([]);

    await notificarEvento(eventoNova);

    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it("monta o e-mail sem o link quando o endereço do app não está configurado", () => {
    const email = montarEmail(
      { tipo: "solicitacao_aceita", mensagem: "Sua solicitação foi aceita.", link: "/solicitacoes" },
      undefined,
    );

    expect(email).toEqual({ assunto: "MSV: sua solicitação foi aceita", texto: "Sua solicitação foi aceita." });
  });
});

describe("textoDoEvento", () => {
  it("corta a mensagem no limite da coluna", () => {
    const texto = textoDoEvento({
      evento: "recusada",
      itemNome: "Furadeira",
      solicitanteId: "col",
      motivo: "x".repeat(500),
    });

    expect(texto.mensagem).toHaveLength(LIMITE_MENSAGEM);
    expect(texto.mensagem.endsWith("…")).toBe(true);
  });
});

describe("listarNotificacoes", () => {
  it("devolve as últimas 20 do usuário e o total de não lidas", async () => {
    repo.listarDoUsuario.mockResolvedValue([
      {
        id: "n1",
        usuarioId: "col",
        tipo: "solicitacao_aceita",
        mensagem: "Aceita",
        link: "/solicitacoes",
        lida: false,
        criadoEm: new Date("2026-10-14T12:00:00Z"),
      } satisfies NotificacaoRegistro,
    ]);
    repo.contarNaoLidas.mockResolvedValue(37);

    const lista = await listarNotificacoes(colaborador);

    expect(repo.listarDoUsuario).toHaveBeenCalledWith("col", 20);
    expect(lista.naoLidas).toBe(37);
    expect(lista.itens[0]).toEqual({
      id: "n1",
      tipo: "solicitacao_aceita",
      mensagem: "Aceita",
      link: "/solicitacoes",
      lida: false,
      criadoEm: "2026-10-14T12:00:00.000Z",
    });
  });

  it("usuário inativo não lista", async () => {
    await expect(listarNotificacoes({ ...colaborador, ativo: false })).rejects.toMatchObject({
      codigo: "USUARIO_INATIVO",
    });
  });
});

describe("marcar como lida", () => {
  it("marca só a notificação do próprio usuário", async () => {
    repo.marcarLida.mockResolvedValue(true);

    await marcarComoLida(colaborador, "n1");

    expect(repo.marcarLida).toHaveBeenCalledWith("n1", "col");
  });

  it("notificação de outro usuário ou inexistente", async () => {
    repo.marcarLida.mockResolvedValue(false);

    await expect(marcarComoLida(colaborador, "n9")).rejects.toMatchObject({ codigo: "NOTIFICACAO_NAO_ENCONTRADA" });
  });

  it("marcar todas atinge só as do próprio usuário", async () => {
    repo.marcarTodasLidas.mockResolvedValue(5);

    await marcarTodasComoLidas(colaborador);

    expect(repo.marcarTodasLidas).toHaveBeenCalledWith("col");
  });
});
