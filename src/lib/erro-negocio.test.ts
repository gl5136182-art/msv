import { afterEach, describe, expect, it, vi } from "vitest";

import { ErroNegocio, executar, falha, sucesso } from "@/lib/erro-negocio";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErroNegocio", () => {
  it("carrega o código e a mensagem para o usuário", () => {
    const erro = new ErroNegocio("UT_INATIVA", "A UT está inativa.");
    expect(erro).toBeInstanceOf(Error);
    expect(erro.codigo).toBe("UT_INATIVA");
    expect(erro.message).toBe("A UT está inativa.");
  });
});

describe("sucesso e falha", () => {
  it("montam o formato { ok, dados } e { ok, erro }", () => {
    expect(sucesso({ id: "1" })).toEqual({ ok: true, dados: { id: "1" } });
    expect(sucesso()).toEqual({ ok: true, dados: undefined });
    expect(falha("Algo deu errado.")).toEqual({ ok: false, erro: "Algo deu errado." });
    expect(falha("Algo deu errado.", "X")).toEqual({
      ok: false,
      erro: "Algo deu errado.",
      codigo: "X",
    });
  });
});

describe("executar", () => {
  it("devolve os dados quando a operação conclui", async () => {
    await expect(executar(async () => 42)).resolves.toEqual({ ok: true, dados: 42 });
  });

  it("converte ErroNegocio em { ok: false, erro } com a mensagem em português", async () => {
    const resultado = await executar(async () => {
      throw new ErroNegocio("SEM_PERMISSAO", "Você não tem permissão para isso.");
    });
    expect(resultado).toEqual({
      ok: false,
      erro: "Você não tem permissão para isso.",
      codigo: "SEM_PERMISSAO",
    });
  });

  it("troca erros inesperados por mensagem genérica e registra no servidor", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const resultado = await executar(async () => {
      throw new Error("connection refused: postgres://usuario:senha@host");
    });

    expect(resultado).toEqual({
      ok: false,
      erro: "Não foi possível concluir a ação. Tente novamente.",
    });
    expect(JSON.stringify(resultado)).not.toContain("postgres");
    expect(log).toHaveBeenCalledOnce();
  });

  it("relança o controle de fluxo do Next (redirect, notFound)", async () => {
    const redirecionamento = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/login;307;",
    });
    await expect(
      executar(async () => {
        throw redirecionamento;
      }),
    ).rejects.toBe(redirecionamento);
  });

  it("relança a rejeição de headers() durante o prerender, sem registrar como erro", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const pendente = Object.assign(new Error("During prerendering, `headers()` rejects..."), {
      digest: "HANGING_PROMISE_REJECTION",
    });

    await expect(
      executar(async () => {
        throw pendente;
      }),
    ).rejects.toBe(pendente);
    expect(log).not.toHaveBeenCalled();
  });
});
