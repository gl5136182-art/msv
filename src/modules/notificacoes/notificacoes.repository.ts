import { db, type ClienteDb } from "@/infra/db";
import type { Prisma } from "@/generated/prisma/client";

export type NotificacaoRegistro = Prisma.NotificacaoGetPayload<Record<string, never>>;

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
