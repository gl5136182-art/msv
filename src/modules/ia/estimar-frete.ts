import { z } from "zod";

import { completarJson } from "@/infra/llm";

// Estimativa de frete na vitrine (SPEC §6.6). Compara três caminhos para levar o item até a UT
// de quem pede: comprar novo do fornecedor, enviar por transportadora ou buscar com veículo
// próprio. Divisão de trabalho:
//   - o código consolida a carga (medidas × quantidade) e calcula a compra nova (valor de
//     reposição × quantidade);
//   - a IA estima só o que depende de mercado: distância entre as cidades e as faixas de preço
//     da transportadora e do veículo próprio;
//   - o código escolhe a opção mais barata (ponto médio das faixas).
// Endereço = cidade/UF da UT (o cadastro ainda não tem endereço completo). É uma estimativa,
// sem cotação real. Sem IA, não há estimativa: a tela esconde o botão.

/** Carga a transportar, já multiplicada pela quantidade. */
export type Carga = {
  /** `false`: o item não tem medidas nem lote; a IA estima a partir do nome. */
  medidasInformadas: boolean;
  pesoTotalKg: number | null;
  volumeTotalM3: number | null;
  /** Maior lado de uma peça, em cm (diz se cabe em carro, utilitário ou caminhão). */
  maiorDimensaoCm: number | null;
};

export type MedidasDoItem = {
  larguraCm: number | null;
  alturaCm: number | null;
  profundidadeCm: number | null;
  pesoKg: number | null;
  lote: { larguraCm: number; alturaCm: number; profundidadeCm: number; pesoKg: number } | null;
  quantidadeDisponivel: number;
};

export type Faixa = { min: number; max: number };

export type EstimativaIa = {
  distanciaKm: number;
  transportadora: Faixa;
  veiculoProprio: Faixa;
  justificativa: string;
};

export type OpcaoFrete = "compra" | "transportadora" | "veiculo";

const TAMANHO_JUSTIFICATIVA = 400;

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

/**
 * Soma a carga da quantidade pedida. Usa as medidas por unidade quando existem; sem elas, rateia
 * o lote pela fração pedida do disponível (o lote descreve tudo o que está disponível).
 */
export function consolidarCarga(item: MedidasDoItem, quantidade: number): Carga {
  const { larguraCm, alturaCm, profundidadeCm, pesoKg } = item;
  const lados = larguraCm !== null && alturaCm !== null && profundidadeCm !== null
    ? [larguraCm, alturaCm, profundidadeCm]
    : null;

  if (lados || pesoKg !== null) {
    return {
      medidasInformadas: true,
      pesoTotalKg: pesoKg === null ? null : arredondar(pesoKg * quantidade, 2),
      volumeTotalM3: lados ? arredondar(((lados[0] * lados[1] * lados[2]) / 1e6) * quantidade, 3) : null,
      maiorDimensaoCm: lados ? Math.max(...lados) : null,
    };
  }

  if (item.lote && item.quantidadeDisponivel > 0) {
    const { lote } = item;
    const fracao = Math.min(quantidade / item.quantidadeDisponivel, 1);
    return {
      medidasInformadas: true,
      pesoTotalKg: arredondar(lote.pesoKg * fracao, 2),
      volumeTotalM3: arredondar(((lote.larguraCm * lote.alturaCm * lote.profundidadeCm) / 1e6) * fracao, 3),
      // Sem a medida da peça, o maior lado do lote é o limite seguro.
      maiorDimensaoCm: Math.max(lote.larguraCm, lote.alturaCm, lote.profundidadeCm),
    };
  }

  return { medidasInformadas: false, pesoTotalKg: null, volumeTotalM3: null, maiorDimensaoCm: null };
}

const SISTEMA_FRETE = `Você estima custos de transporte rodoviário no Brasil para uma empresa de serviços (facilities, manutenção industrial, logística) que transfere materiais e equipamentos entre suas unidades.
Você recebe a cidade/UF de origem e de destino, o item (nome, marca, modelo, categoria), a quantidade e a carga total (peso em kg, volume em m³, maior lado de uma peça em cm). Quando a carga vier sem medidas, estime o peso e o volume típicos do item pelo nome.
Estime, em reais (BRL), valores atuais de mercado:
- "distanciaKm": distância rodoviária aproximada entre as cidades (mesma cidade: deslocamento urbano, de 5 a 30 km);
- "transportadora": faixa de preço para enviar por transportadora (carga fracionada; considere peso cubado, frete-valor, GRIS e pedágio; carga grande ou pesada pode exigir caminhão dedicado);
- "veiculoProprio": faixa de preço para um funcionário ir buscar com veículo da empresa ou alugado (ida e volta: combustível, pedágios, desgaste ou aluguel do veículo adequado à carga, diária e horas do motorista);
- "justificativa": até 300 caracteres, em português, explicando as premissas (veículo, tempo de viagem).
Use números (sem símbolo de moeda), com "min" menor ou igual a "max".
Responda só com JSON no formato {"distanciaKm":0,"transportadora":{"min":0,"max":0},"veiculoProprio":{"min":0,"max":0},"justificativa":"..."}.`;

const faixaSchema = z
  .object({ min: z.coerce.number().nonnegative(), max: z.coerce.number().nonnegative() })
  .refine((f) => f.min <= f.max);

const respostaFreteSchema = z.object({
  distanciaKm: z.coerce.number().nonnegative(),
  transportadora: faixaSchema,
  veiculoProprio: faixaSchema,
  justificativa: z.string().default(""),
});

export type PedidoFrete = {
  origem: { cidade: string; uf: string };
  destino: { cidade: string; uf: string };
  item: { nome: string; marca: string; modelo: string; categoria: string };
  quantidade: number;
  unidade: string;
  carga: Carga;
};

/** Pede a estimativa à IA. `null` se a IA está desligada, falhou ou respondeu fora do formato. */
export async function estimarFrete(pedido: PedidoFrete): Promise<EstimativaIa | null> {
  const { carga } = pedido;
  const resposta = await completarJson({
    sistema: SISTEMA_FRETE,
    usuario: JSON.stringify({
      origem: `${pedido.origem.cidade}/${pedido.origem.uf}`,
      destino: `${pedido.destino.cidade}/${pedido.destino.uf}`,
      item: pedido.item,
      quantidade: pedido.quantidade,
      unidade: pedido.unidade,
      carga: carga.medidasInformadas
        ? {
            pesoTotalKg: carga.pesoTotalKg ?? undefined,
            volumeTotalM3: carga.volumeTotalM3 ?? undefined,
            maiorDimensaoCm: carga.maiorDimensaoCm ?? undefined,
          }
        : "sem medidas: estime pelo item",
    }),
  });
  const lida = respostaFreteSchema.safeParse(resposta);
  if (!lida.success) return null;

  const faixa = (f: Faixa): Faixa => ({ min: arredondar(f.min, 2), max: arredondar(f.max, 2) });
  return {
    distanciaKm: Math.round(lida.data.distanciaKm),
    transportadora: faixa(lida.data.transportadora),
    veiculoProprio: faixa(lida.data.veiculoProprio),
    justificativa: lida.data.justificativa.trim().slice(0, TAMANHO_JUSTIFICATIVA),
  };
}

/**
 * Compara as três opções e aponta a mais barata. Compra nova = valor de reposição × quantidade;
 * as faixas entram pelo ponto médio. No empate, transferir vence comprar (o item já existe).
 */
export function compararOpcoes(
  valorUnitarioReposicao: number,
  quantidade: number,
  estimativa: Pick<EstimativaIa, "transportadora" | "veiculoProprio">,
): { compraNova: number; recomendada: OpcaoFrete } {
  const compraNova = arredondar(valorUnitarioReposicao * quantidade, 2);
  const medio = (f: Faixa) => (f.min + f.max) / 2;
  const custos: Array<[OpcaoFrete, number]> = [
    ["transportadora", medio(estimativa.transportadora)],
    ["veiculo", medio(estimativa.veiculoProprio)],
    ["compra", compraNova],
  ];
  const [recomendada] = custos.reduce((melhor, atual) => (atual[1] < melhor[1] ? atual : melhor));
  return { compraNova, recomendada };
}
