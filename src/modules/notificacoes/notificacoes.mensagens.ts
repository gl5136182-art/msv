import type { TipoNotificacao } from "./notificacoes.schemas";

// Textos e destinos das notificações dos eventos de solicitação (SPEC §6.4). Funções puras.

/** Limite da coluna `mensagem` (VarChar 300). */
export const LIMITE_MENSAGEM = 300;

/** Onde cada lado abre a solicitação: o solicitante em "Minhas", a origem em "Recebidas". */
export const LINK_MINHAS = "/solicitacoes";
export const LINK_RECEBIDAS = "/solicitacoes?aba=recebidas";

/** Quem recebe e o que recebe, antes de resolver os destinatários. */
export type EventoSolicitacao =
  | {
      evento: "nova";
      itemNome: string;
      quantidade: number;
      unidade: string;
      solicitanteId: string;
      solicitanteNome: string;
      utOrigemId: string;
    }
  | { evento: "aceita"; itemNome: string; solicitanteId: string }
  | { evento: "recusada"; itemNome: string; solicitanteId: string; motivo: string }
  | { evento: "cancelada_pela_origem"; itemNome: string; solicitanteId: string }
  | { evento: "cancelada_automaticamente"; itemNome: string; solicitanteId: string }
  | { evento: "cancelada_pelo_solicitante"; itemNome: string; solicitanteId: string; solicitanteNome: string; utOrigemId: string }
  | { evento: "concluida"; itemNome: string; atorId: string; atorNome: string; utOrigemId: string };

export type TextoNotificacao = { tipo: TipoNotificacao; mensagem: string; link: string };

function limitar(texto: string): string {
  return texto.length <= LIMITE_MENSAGEM ? texto : `${texto.slice(0, LIMITE_MENSAGEM - 1)}…`;
}

export function textoDoEvento(evento: EventoSolicitacao): TextoNotificacao {
  switch (evento.evento) {
    case "nova":
      return {
        tipo: "solicitacao_nova",
        mensagem: limitar(
          `Nova solicitação: ${evento.solicitanteNome} pediu ${evento.quantidade} ${evento.unidade} de ${evento.itemNome}.`,
        ),
        link: LINK_RECEBIDAS,
      };
    case "aceita":
      return {
        tipo: "solicitacao_aceita",
        mensagem: limitar(`Sua solicitação de ${evento.itemNome} foi aceita. Veja o contato para combinar o transporte.`),
        link: LINK_MINHAS,
      };
    case "recusada":
      return {
        tipo: "solicitacao_recusada",
        mensagem: limitar(`Sua solicitação de ${evento.itemNome} foi recusada. Motivo: ${evento.motivo}`),
        link: LINK_MINHAS,
      };
    case "cancelada_pela_origem":
      return {
        tipo: "solicitacao_cancelada",
        mensagem: limitar(`Sua solicitação de ${evento.itemNome} foi cancelada pela UT de origem.`),
        link: LINK_MINHAS,
      };
    case "cancelada_automaticamente":
      return {
        tipo: "solicitacao_cancelada",
        mensagem: limitar(`Sua solicitação de ${evento.itemNome} foi cancelada: uma das UTs foi desativada.`),
        link: LINK_MINHAS,
      };
    case "cancelada_pelo_solicitante":
      return {
        tipo: "solicitacao_cancelada",
        mensagem: limitar(`${evento.solicitanteNome} cancelou a solicitação de ${evento.itemNome}.`),
        link: LINK_RECEBIDAS,
      };
    case "concluida":
      return {
        tipo: "solicitacao_concluida",
        mensagem: limitar(`${evento.atorNome} confirmou o recebimento de ${evento.itemNome}.`),
        link: LINK_RECEBIDAS,
      };
  }
}

const ASSUNTO_POR_TIPO: Record<TextoNotificacao["tipo"], string> = {
  solicitacao_nova: "MSV: nova solicitação para um item da sua UT",
  solicitacao_aceita: "MSV: sua solicitação foi aceita",
  solicitacao_recusada: "MSV: sua solicitação foi recusada",
  solicitacao_cancelada: "MSV: solicitação cancelada",
  solicitacao_concluida: "MSV: recebimento confirmado",
};

/**
 * Assunto e corpo (texto simples) do e-mail de um evento. `baseUrl` é o endereço do app
 * (`BETTER_AUTH_URL`); sem ele o e-mail sai sem o link.
 */
export function montarEmail(texto: TextoNotificacao, baseUrl: string | undefined): { assunto: string; texto: string } {
  const base = baseUrl?.replace(/\/+$/, "");
  const corpo = base ? `${texto.mensagem}\n\nAbra no MSV: ${base}${texto.link}` : texto.mensagem;
  return { assunto: ASSUNTO_POR_TIPO[texto.tipo], texto: corpo };
}
