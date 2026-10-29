import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cotarFretes, type PedidoCotacaoFrete } from "./frete";

const pedido: PedidoCotacaoFrete = {
  cepOrigem: "38400000",
  cepDestino: "13010000",
  valorDeclarado: 901.8,
  pacote: { products: [{ quantity: 2, weight: 2.1, height: 25, width: 30, length: 10 }] },
};

const respostaValida = [
  {
    id: 1,
    name: "PAC",
    price: "120.559",
    delivery_time: 8,
    company: { name: "Correios" },
  },
  {
    id: 3,
    name: "Jadlog",
    price: 98.5,
    delivery_range: { min: 5, max: 7 },
    company: { name: "Jadlog" },
  },
];

beforeEach(() => {
  vi.stubEnv("SUPERFRETE_TOKEN", "token-teste");
  vi.stubEnv("SUPERFRETE_BASE_URL", "https://sandbox.superfrete.com/");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cotarFretes", () => {
  it("monta a requisição e normaliza preço e prazo", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(respostaValida), { status: 200 }));

    await expect(cotarFretes(pedido)).resolves.toEqual([
      { id: 1, transportadora: "Correios", servico: "PAC", valor: 120.56, prazoDias: 8 },
      { id: 3, transportadora: "Jadlog", servico: "Jadlog", valor: 98.5, prazoDias: 7 },
    ]);

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://sandbox.superfrete.com/api/v0/calculator");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer token-teste" });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: { postal_code: "38400000" },
      to: { postal_code: "13010000" },
      options: { insurance_value: 901.8, use_insurance_value: true },
      products: [{ quantity: 2, weight: 2.1, height: 25, width: 30, length: 10 }],
    });
  });

  it("descarta serviços com erro e entradas inválidas sem perder as demais", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          respostaValida[0],
          { ...respostaValida[1], has_error: true },
          { id: "inválido" },
        ]),
        { status: 200 },
      ),
    );

    const cotacoes = await cotarFretes(pedido);
    expect(cotacoes).toHaveLength(1);
    expect(cotacoes?.[0].id).toBe(1);
  });

  it("devolve null em falha HTTP ou formato inesperado", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 500 }));
    await expect(cotarFretes(pedido)).resolves.toBeNull();

    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(cotarFretes(pedido)).resolves.toBeNull();
  });

  it("sem token não chama o provedor", async () => {
    vi.stubEnv("SUPERFRETE_TOKEN", "");
    await expect(cotarFretes(pedido)).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
