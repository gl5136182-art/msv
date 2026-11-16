import type { StatusItem } from "./itens.schemas";

// Regras puras de quantidade e status do item (SPEC §3, regras 2, 3 e 4). Sem acesso a banco:
// o service usa estas funções.

/**
 * Status do item depois que a quantidade disponível mudou (regra 3):
 * - chegou a 0 → `esgotado`;
 * - voltou a ser > 0 → `disponivel`;
 * - `arquivado` é decisão manual e não muda por quantidade (regra 4).
 */
export function statusAposMudarQuantidade(statusAtual: StatusItem, quantidadeDisponivel: number): StatusItem {
  if (statusAtual === "arquivado" || statusAtual === "transferido") return statusAtual;
  return quantidadeDisponivel > 0 ? "disponivel" : "esgotado";
}

export type ResultadoDoAjuste = {
  quantidadeDisponivel: number;
  quantidadeTotal: number;
  status: StatusItem;
};

/**
 * Ajuste manual da quantidade disponível pelo almoxarife (regra 2). Nunca fica negativa.
 * Se o novo valor passa do total cadastrado, o total sobe junto (o item passa a ter mais
 * unidades cadastradas, e o dashboard conta isso).
 */
export function calcularAjusteDeQuantidade(
  item: { quantidadeTotal: number; status: StatusItem },
  novaQuantidadeDisponivel: number,
): ResultadoDoAjuste {
  if (!Number.isInteger(novaQuantidadeDisponivel) || novaQuantidadeDisponivel < 0) {
    throw new RangeError("A quantidade disponível deve ser um inteiro maior ou igual a zero.");
  }
  return {
    quantidadeDisponivel: novaQuantidadeDisponivel,
    quantidadeTotal: Math.max(item.quantidadeTotal, novaQuantidadeDisponivel),
    status: statusAposMudarQuantidade(item.status, novaQuantidadeDisponivel),
  };
}

/**
 * Arquivar retira o item da vitrine (regra 4); reativar devolve ao status que a quantidade
 * indica: `disponivel` se há unidades, `esgotado` se não há.
 */
export function statusAposArquivamento(arquivar: boolean, quantidadeDisponivel: number): StatusItem {
  if (arquivar) return "arquivado";
  return quantidadeDisponivel > 0 ? "disponivel" : "esgotado";
}

/**
 * Transferência de unidades para fora da UT. Desconta do disponível e do total (as unidades
 * saíram). Sobrando unidades, o item segue como está; zerando, vira `transferido`.
 */
export function calcularTransferencia(
  item: { quantidadeTotal: number; quantidadeDisponivel: number; status: StatusItem },
  quantidade: number,
): ResultadoDoAjuste {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new RangeError("A quantidade transferida deve ser um inteiro maior que zero.");
  }
  if (quantidade > item.quantidadeDisponivel) {
    throw new RangeError("A quantidade transferida passa do disponível.");
  }
  const quantidadeDisponivel = item.quantidadeDisponivel - quantidade;
  return {
    quantidadeDisponivel,
    quantidadeTotal: Math.max(item.quantidadeTotal - quantidade, 0),
    status: quantidadeDisponivel > 0 ? item.status : "transferido",
  };
}
