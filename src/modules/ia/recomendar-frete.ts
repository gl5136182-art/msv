import { z } from "zod";

import type { CotacaoFrete } from "@/infra/frete";
import { completarJson } from "@/infra/llm";

export type Faixa = { min: number; max: number };

export type RecomendacaoFrete = {
  tipo: "cotacao" | "veiculo" | "compra";
  cotacaoId: number | null;
  origem: "ia" | "menor_custo";
  justificativa: string;
};

export type DecisaoFreteIa = {
  distanciaKm: number;
  veiculoProprio: Faixa;
  recomendacao: RecomendacaoFrete;
};

export type PedidoRecomendacaoFrete = {
  origem: string;
  destino: string;
  item: { nome: string; marca: string; modelo: string; categoria: string };
  quantidade: number;
  unidade: string;
  carga: { pesoTotalKg: number; volumeTotalM3: number; maiorDimensaoCm: number };
  cotacoes: CotacaoFrete[];
  compraNova: number;
};

const faixaSchema = z
  .object({ min: z.coerce.number().nonnegative(), max: z.coerce.number().nonnegative() })
  .refine((faixa) => faixa.min <= faixa.max);

const respostaSchema = z.object({
  distanciaKm: z.coerce.number().nonnegative(),
  veiculoProprio: faixaSchema,
  recomendada: z.string(),
  justificativa: z.string().max(500),
});

const SISTEMA = `Você recomenda a melhor forma de obter materiais e equipamentos para uma empresa brasileira.
Recebe cotações reais de transportadoras, o custo de comprar o item novo e os dados da carga. Compare preço e prazo.
As cotações têm referências "frete_ID". Você também pode escolher "veiculo" (buscar com veículo próprio) ou "compra".
Estime a distância rodoviária e uma faixa de custo de ida e volta com veículo próprio, incluindo combustível, pedágios, desgaste ou aluguel, motorista e veículo adequado à carga. Mesma cidade: deslocamento urbano de 5 a 30 km.
Não altere valores ou prazos das cotações. Escolha somente uma referência recebida. Se não houver urgência informada, o menor custo total pesa mais; um prazo menor só justifica um custo maior quando houver benefício operacional claro.
Responda só com JSON: {"distanciaKm":0,"veiculoProprio":{"min":0,"max":0},"recomendada":"frete_1","justificativa":"até 300 caracteres"}.`;

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export async function recomendarFrete(pedido: PedidoRecomendacaoFrete): Promise<DecisaoFreteIa | null> {
  const resposta = await completarJson({
    sistema: SISTEMA,
    usuario: JSON.stringify({
      origem: pedido.origem,
      destino: pedido.destino,
      item: pedido.item,
      quantidade: pedido.quantidade,
      unidade: pedido.unidade,
      carga: pedido.carga,
      compraNova: pedido.compraNova,
      cotacoes: pedido.cotacoes.map((cotacao) => ({
        referencia: `frete_${cotacao.id}`,
        transportadora: cotacao.transportadora,
        servico: cotacao.servico,
        valor: cotacao.valor,
        prazoDias: cotacao.prazoDias,
      })),
      veiculo: "estime ida e volta",
      compra: "referencia compra",
    }),
  });
  const lida = respostaSchema.safeParse(resposta);
  if (!lida.success) return null;

  const recomendacao = interpretarReferencia(lida.data.recomendada, pedido.cotacoes);
  if (!recomendacao) return null;
  return {
    distanciaKm: Math.round(lida.data.distanciaKm),
    veiculoProprio: {
      min: arredondar(lida.data.veiculoProprio.min),
      max: arredondar(lida.data.veiculoProprio.max),
    },
    recomendacao: {
      ...recomendacao,
      origem: "ia",
      justificativa: lida.data.justificativa.trim().slice(0, 300),
    },
  };
}

function interpretarReferencia(
  referencia: string,
  cotacoes: CotacaoFrete[],
): Pick<RecomendacaoFrete, "tipo" | "cotacaoId"> | null {
  if (referencia === "compra") return { tipo: "compra", cotacaoId: null };
  if (referencia === "veiculo") return { tipo: "veiculo", cotacaoId: null };
  if (!referencia.startsWith("frete_")) return null;
  const id = Number(referencia.slice(6));
  return Number.isInteger(id) && cotacoes.some((cotacao) => cotacao.id === id)
    ? { tipo: "cotacao", cotacaoId: id }
    : null;
}

export function recomendarMenorCusto(
  cotacoes: CotacaoFrete[],
  compraNova: number,
): RecomendacaoFrete {
  const ordenadas = [...cotacoes].sort(
    (a, b) => a.valor - b.valor || (a.prazoDias ?? Infinity) - (b.prazoDias ?? Infinity),
  );
  const maisBarata = ordenadas[0];
  if (maisBarata && maisBarata.valor <= compraNova) {
    return {
      tipo: "cotacao",
      cotacaoId: maisBarata.id,
      origem: "menor_custo",
      justificativa: "Menor valor entre as opções disponíveis.",
    };
  }
  return {
    tipo: "compra",
    cotacaoId: null,
    origem: "menor_custo",
    justificativa: "Comprar novo tem o menor valor entre as opções disponíveis.",
  };
}
