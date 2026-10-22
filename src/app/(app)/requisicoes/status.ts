import type { StatusRequisicao } from "@/modules/requisicoes/requisicoes.schemas";

/** Cor do selo de status da requisição (DESIGN §2). */
export const VARIANTE_STATUS: Record<StatusRequisicao, "neutro" | "atencao" | "info" | "ok" | "erro"> = {
  rascunho: "neutro",
  aberta: "atencao",
  atendida_reuso: "ok",
  parcial: "info",
  enviada_compra: "info",
  cancelada: "erro",
};
