import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { enviarEmail } from "./email";

const email = { para: "maria@manserv.com.br", assunto: "Nova solicitação", texto: "Corpo do e-mail" };

const fetchFalso = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchFalso);
  vi.stubEnv("RESEND_API_KEY", "re_chave_de_teste");
  vi.stubEnv("EMAIL_FROM", "MSV <msv@exemplo.com.br>");
  fetchFalso.mockResolvedValue({ ok: true, status: 200 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("enviarEmail (SPEC §6.4)", () => {
  it("envia pelo Resend com a chave, o remetente e o destinatário", async () => {
    await expect(enviarEmail(email)).resolves.toBe(true);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(opcoes.headers.Authorization).toBe("Bearer re_chave_de_teste");
    expect(JSON.parse(opcoes.body)).toEqual({
      from: "MSV <msv@exemplo.com.br>",
      to: ["maria@manserv.com.br"],
      subject: "Nova solicitação",
      text: "Corpo do e-mail",
    });
  });

  it("sem RESEND_API_KEY não envia nada e não falha", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(enviarEmail(email)).resolves.toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("sem EMAIL_FROM não envia nada", async () => {
    vi.stubEnv("EMAIL_FROM", "");

    await expect(enviarEmail(email)).resolves.toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("resposta de erro do provedor vira false, sem lançar e sem registrar o destinatário", async () => {
    fetchFalso.mockResolvedValue({ ok: false, status: 422 });
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(enviarEmail(email)).resolves.toBe(false);
    expect(JSON.stringify(erro.mock.calls)).not.toContain("maria@manserv.com.br");
    erro.mockRestore();
  });

  it("falha de rede ou timeout vira false, sem lançar", async () => {
    fetchFalso.mockRejectedValue(new Error("fetch failed"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(enviarEmail(email)).resolves.toBe(false);
    erro.mockRestore();
  });
});
