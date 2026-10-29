import { z } from "zod";

// Notificações in-app (SPEC §6.4). Importado também por componentes de cliente: só depende do Zod.

/** Quantas notificações o sino lista (SPEC §6.4: "as últimas 20"). */
export const LIMITE_NOTIFICACOES = 20;

export const marcarLidaSchema = z.object({ id: z.string().min(1, "Notificação inválida.") });
export type MarcarLidaEntrada = z.infer<typeof marcarLidaSchema>;

export type NotificacaoDto = {
  id: string;
  tipo: string;
  mensagem: string;
  /** Rota interna aberta ao clicar. */
  link: string;
  lida: boolean;
  criadoEm: string;
};

export type ListaNotificacoesDto = {
  /** As últimas {@link LIMITE_NOTIFICACOES}, da mais recente para a mais antiga. */
  itens: NotificacaoDto[];
  /** Total de não lidas (pode ser maior que as listadas). */
  naoLidas: number;
};
