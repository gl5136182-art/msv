import { ErroNegocio } from "@/lib/erro-negocio";
import { exigirPapel } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/usuario-logado";

import * as repository from "./notificacoes.repository";
import type { NotificacaoRegistro } from "./notificacoes.repository";
import { LIMITE_NOTIFICACOES, type ListaNotificacoesDto, type NotificacaoDto } from "./notificacoes.schemas";

// Notificações in-app (SPEC §6.4): o sino lista e marca como lidas.

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
