import { db, type ClienteDb } from "@/infra/db";
import type { Prisma } from "@/generated/prisma/client";

export type NotificacaoRegistro = Prisma.NotificacaoGetPayload<Record<string, never>>;

export type DadosNotificacao = {
  usuarioId: string;
  tipo: string;
  mensagem: string;
  link: string;
};

export type UsuarioParaNotificar = { id: string; name: string; email: string };

export async function criarVarias(dados: DadosNotificacao[], cliente: ClienteDb = db): Promise<void> {
  if (dados.length === 0) return;
  await cliente.notificacao.createMany({ data: dados });
}

/** As últimas notificações do usuário, da mais recente para a mais antiga. */
export function listarDoUsuario(usuarioId: string, limite: number, cliente: ClienteDb = db): Promise<NotificacaoRegistro[]> {
  return cliente.notificacao.findMany({
    where: { usuarioId },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: limite,
  });
}

export function contarNaoLidas(usuarioId: string, cliente: ClienteDb = db): Promise<number> {
  return cliente.notificacao.count({ where: { usuarioId, lida: false } });
}

/** Marca como lida só se a notificação é do usuário. Devolve `false` se não achou. */
export async function marcarLida(id: string, usuarioId: string, cliente: ClienteDb = db): Promise<boolean> {
  const { count } = await cliente.notificacao.updateMany({ where: { id, usuarioId }, data: { lida: true } });
  return count === 1;
}

export async function marcarTodasLidas(usuarioId: string, cliente: ClienteDb = db): Promise<number> {
  const { count } = await cliente.notificacao.updateMany({ where: { usuarioId, lida: false }, data: { lida: true } });
  return count;
}

/** Almoxarifes ativos da UT: quem recebe os eventos "do lado da origem". */
export function listarAlmoxarifesAtivosDaUt(utId: string, cliente: ClienteDb = db): Promise<UsuarioParaNotificar[]> {
  return cliente.usuario.findMany({
    where: { utId, papel: "almoxarife", ativo: true },
    select: { id: true, name: true, email: true },
  });
}

export function buscarUsuariosAtivos(ids: string[], cliente: ClienteDb = db): Promise<UsuarioParaNotificar[]> {
  return cliente.usuario.findMany({
    where: { id: { in: ids }, ativo: true },
    select: { id: true, name: true, email: true },
  });
}
