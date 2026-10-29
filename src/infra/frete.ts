import { z } from "zod";

const BASE_URL_PADRAO = "https://sandbox.superfrete.com";
const TIMEOUT_MS = 20_000;

export type CotacaoFrete = {
  id: number;
  transportadora: string;
  servico: string;
  valor: number;
  prazoDias: number | null;
};

export type PedidoCotacaoFrete = {
  cepOrigem: string;
  cepDestino: string;
  valorDeclarado: number;
  pacote:
    | {
        products: Array<{ quantity: number; weight: number; height: number; width: number; length: number }>;
      }
    | { package: { weight: number; height: number; width: number; length: number } };
};

const cotacaoSchema = z.object({
  id: z.coerce.number().int(),
  name: z.string().min(1),
  price: z.coerce.number().nonnegative(),
  delivery_time: z.coerce.number().int().nonnegative().nullable().optional(),
  delivery_range: z
    .object({ min: z.coerce.number().int().nonnegative(), max: z.coerce.number().int().nonnegative() })
    .nullable()
    .optional(),
  company: z.object({ name: z.string().min(1) }),
  has_error: z.boolean().optional(),
  error: z.string().optional(),
});

const respostaSchema = z.array(z.unknown());

export function freteDisponivel(): boolean {
  return Boolean(process.env.SUPERFRETE_TOKEN);
}

/** Devolve `null` quando o provedor não está configurado, falha ou responde fora do contrato. */
export async function cotarFretes(pedido: PedidoCotacaoFrete): Promise<CotacaoFrete[] | null> {
  const token = process.env.SUPERFRETE_TOKEN;
  if (!token) return null;

  const baseUrl = (process.env.SUPERFRETE_BASE_URL || BASE_URL_PADRAO).replace(/\/+$/, "");
  try {
    const resposta = await fetch(`${baseUrl}/api/v0/calculator`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": process.env.SUPERFRETE_USER_AGENT || "MSV/1.0 (integracao@manserv.com.br)",
      },
      body: JSON.stringify({
        from: { postal_code: pedido.cepOrigem },
        to: { postal_code: pedido.cepDestino },
        services: "1,2,17,3,33,31",
        options: {
          own_hand: false,
          receipt: false,
          insurance_value: pedido.valorDeclarado,
          use_insurance_value: true,
        },
        ...pedido.pacote,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!resposta.ok) {
      console.error("Frete: a SuperFrete respondeu", resposta.status);
      return null;
    }
    const lida = respostaSchema.safeParse(await resposta.json());
    if (!lida.success) {
      console.error("Frete: resposta da SuperFrete fora do formato esperado");
      return null;
    }

    return lida.data.flatMap((entrada) => {
      const lidaCotacao = cotacaoSchema.safeParse(entrada);
      if (!lidaCotacao.success) return [];
      const cotacao = lidaCotacao.data;
      if (cotacao.has_error || cotacao.error || cotacao.price <= 0) return [];
      return [
        {
          id: cotacao.id,
          transportadora: cotacao.company.name,
          servico: cotacao.name,
          valor: Math.round(cotacao.price * 100) / 100,
          prazoDias: cotacao.delivery_time ?? cotacao.delivery_range?.max ?? null,
        },
      ];
    });
  } catch (erro) {
    console.error("Frete: falha na chamada à SuperFrete:", erro instanceof Error ? erro.message : erro);
    return null;
  }
}
