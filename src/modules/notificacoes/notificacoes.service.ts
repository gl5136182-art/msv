import { enviarEmail } from "@/infra/email";
import { ErroNegocio } from "@/lib/erro-negocio";
import { exigirPapel } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/usuario-logado";

import { montarEmail, textoDoEvento, type EventoSolicitacao } from "./notificacoes.mensagens";
import * as repository from "./notificacoes.repository";
import type { NotificacaoRegistro, UsuarioParaNotificar } from "./notificacoes.repository";
import { LIMITE_NOTIFICACOES, type ListaNotificacoesDto, type NotificacaoDto } from "./notificacoes.schemas";

// Notificações in-app (SPEC §6.4).

/** Notificação já gravada, com o e-mail do destinatário (usado pelo envio opcional). */
export type NotificacaoCriada = {
  usuarioId: string;
  nome: string;
  email: string;
  tipo: string;
  mensagem: string;
  link: string;
};

function paraDto(n: NotificacaoRegistro): NotificacaoDto {
  return {
    id: n.id,
    tipo: n.tipo,
    mensagem: n.mensagem,
    link: n.link,
    lida: n.lida,
    criadoEm: n.criadoEm.toISOString(),
  };
}

/** Quem recebe cada evento (SPEC §6.4): o solicitante ou os almoxarifes da UT de origem. */
async function destinatarios(evento: EventoSolicitacao): Promise<UsuarioParaNotificar[]> {
  switch (evento.evento) {
    case "nova":
      return repository.listarAlmoxarifesAtivosDaUt(evento.utOrigemId);
    case "cancelada_pelo_solicitante":
      return repository.listarAlmoxarifesAtivosDaUt(evento.utOrigemId);
    case "concluida":
      return repository.listarAlmoxarifesAtivosDaUt(evento.utOrigemId);
    case "aceita":
    case "recusada":
    case "cancelada_pela_origem":
    case "cancelada_automaticamente":
      return repository.buscarUsuariosAtivos([evento.solicitanteId]);
  }
}

/** Quem fez a ação não recebe a própria notificação. */
function autorDoEvento(evento: EventoSolicitacao): string | null {
  switch (evento.evento) {
    case "nova":
    case "cancelada_pelo_solicitante":
      return evento.solicitanteId;
    case "concluida":
      return evento.atorId;
    default:
      return null;
  }
}

/**
 * Grava as notificações de um evento de solicitação e devolve o que foi criado.
 *
 * É um complemento da ação, não parte dela: **nunca lança**. Falha ao notificar é registrada no
 * servidor e a ação de negócio, que já foi concluída, segue valendo. Por isso quem chama deve
 * invocar depois de a transação da ação ter sido confirmada.
 */
export async function notificarEvento(evento: EventoSolicitacao): Promise<NotificacaoCriada[]> {
  try {
    const autor = autorDoEvento(evento);
    const alvos = (await destinatarios(evento)).filter((u) => u.id !== autor);
    if (alvos.length === 0) return [];

    const texto = textoDoEvento(evento);
    await repository.criarVarias(
      alvos.map((u) => ({ usuarioId: u.id, tipo: texto.tipo, mensagem: texto.mensagem, link: texto.link })),
    );

    // E-mail opcional (SPEC §6.4): sem RESEND_API_KEY `enviarEmail` não faz nada, e nunca lança.
    const email = montarEmail(texto, process.env.BETTER_AUTH_URL);
    await Promise.all(alvos.map((u) => enviarEmail({ para: u.email, assunto: email.assunto, texto: email.texto })));

    return alvos.map((u) => ({
      usuarioId: u.id,
      nome: u.name,
      email: u.email,
      tipo: texto.tipo,
      mensagem: texto.mensagem,
      link: texto.link,
    }));
  } catch (erro) {
    console.error("Falha ao criar notificações do evento", evento.evento, erro instanceof Error ? erro.message : erro);
    return [];
  }
}

/** As últimas 20 notificações do usuário e o total de não lidas (contador do sino). */
export async function listarNotificacoes(usuario: UsuarioLogado): Promise<ListaNotificacoesDto> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");

  const [itens, naoLidas] = await Promise.all([
    repository.listarDoUsuario(usuario.id, LIMITE_NOTIFICACOES),
    repository.contarNaoLidas(usuario.id),
  ]);
  return { itens: itens.map(paraDto), naoLidas };
}

/** Marca uma notificação do próprio usuário como lida. */
export async function marcarComoLida(usuario: UsuarioLogado, id: string): Promise<void> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");

  const marcada = await repository.marcarLida(id, usuario.id);
  if (!marcada) {
    throw new ErroNegocio("NOTIFICACAO_NAO_ENCONTRADA", "Notificação não encontrada.");
  }
}

export async function marcarTodasComoLidas(usuario: UsuarioLogado): Promise<void> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");
  await repository.marcarTodasLidas(usuario.id);
}
