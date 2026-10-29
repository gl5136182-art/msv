import { ErroNegocio } from "@/lib/erro-negocio";

export type MedidasDoItem = {
  larguraCm: number | null;
  alturaCm: number | null;
  profundidadeCm: number | null;
  pesoKg: number | null;
  lote: { larguraCm: number; alturaCm: number; profundidadeCm: number; pesoKg: number } | null;
  quantidadeDisponivel: number;
};

export type CargaFrete = {
  pesoTotalKg: number;
  volumeTotalM3: number;
  maiorDimensaoCm: number;
  pacote:
    | {
        products: Array<{ quantity: number; weight: number; height: number; width: number; length: number }>;
      }
    | { package: { weight: number; height: number; width: number; length: number } };
};

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function medidasInsuficientes(): never {
  throw new ErroNegocio(
    "MEDIDAS_INSUFICIENTES",
    "Para cotar o frete, cadastre largura, altura, profundidade e peso por unidade/lote.",
  );
}

export function prepararCargaFrete(item: MedidasDoItem, quantidade: number): CargaFrete {
  const porUnidade = [item.larguraCm, item.alturaCm, item.profundidadeCm, item.pesoKg];
  if (porUnidade.every((medida) => medida !== null && medida > 0)) {
    const [larguraCm, alturaCm, profundidadeCm, pesoKg] = porUnidade as number[];
    return {
      pesoTotalKg: arredondar(pesoKg * quantidade, 2),
      volumeTotalM3: arredondar(((larguraCm * alturaCm * profundidadeCm) / 1e6) * quantidade, 3),
      maiorDimensaoCm: Math.max(larguraCm, alturaCm, profundidadeCm),
      pacote: {
        products: [
          {
            quantity: quantidade,
            weight: pesoKg,
            height: alturaCm,
            width: larguraCm,
            length: profundidadeCm,
          },
        ],
      },
    };
  }

  if (item.lote && quantidade === item.quantidadeDisponivel) {
    const { larguraCm, alturaCm, profundidadeCm, pesoKg } = item.lote;
    return {
      pesoTotalKg: pesoKg,
      volumeTotalM3: arredondar((larguraCm * alturaCm * profundidadeCm) / 1e6, 3),
      maiorDimensaoCm: Math.max(larguraCm, alturaCm, profundidadeCm),
      pacote: {
        package: { weight: pesoKg, height: alturaCm, width: larguraCm, length: profundidadeCm },
      },
    };
  }

  return medidasInsuficientes();
}
