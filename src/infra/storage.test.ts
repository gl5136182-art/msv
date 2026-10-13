import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUploadUrl = vi.fn();
const createSignedUrls = vi.fn();
const remove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: { from: () => ({ createSignedUploadUrl, createSignedUrls, remove }) },
  }),
}));

import { criarUrlsUpload, obterUrls, remover } from "./storage";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://exemplo.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave");
  vi.stubEnv("SUPABASE_BUCKET", "msv");
  createSignedUploadUrl.mockReset();
  createSignedUrls.mockReset();
  remove.mockReset();
});

describe("criarUrlsUpload", () => {
  it("devolve uma URL assinada por chave, na ordem recebida", async () => {
    createSignedUploadUrl.mockImplementation(async (chave: string) => ({
      data: { signedUrl: `https://up/${chave}?token=t`, token: "t", path: chave },
      error: null,
    }));
    const r = await criarUrlsUpload(["fotos/2026/10/a.jpg", "fotos/2026/10/a_thumb.jpg"]);
    expect(r).toEqual([
      { chave: "fotos/2026/10/a.jpg", url: "https://up/fotos/2026/10/a.jpg?token=t" },
      { chave: "fotos/2026/10/a_thumb.jpg", url: "https://up/fotos/2026/10/a_thumb.jpg?token=t" },
    ]);
  });

  it("falha quando o storage recusa", async () => {
    createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "negado" } });
    await expect(criarUrlsUpload(["fotos/2026/10/a.jpg"])).rejects.toThrow("negado");
  });

  it("não chama o storage sem chaves", async () => {
    expect(await criarUrlsUpload([])).toEqual([]);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });
});

describe("obterUrls", () => {
  it("mapeia chave → URL, ignora duplicadas e itens com erro", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: "a.jpg", signedUrl: "https://dl/a", error: null },
        { path: "b.jpg", signedUrl: null, error: "Object not found" },
      ],
      error: null,
    });
    const r = await obterUrls(["a.jpg", "a.jpg", "b.jpg"], 3600);
    expect(createSignedUrls).toHaveBeenCalledWith(["a.jpg", "b.jpg"], 3600);
    expect(r).toEqual({ "a.jpg": "https://dl/a" });
  });

  it("devolve vazio sem chaves, sem chamar o storage", async () => {
    expect(await obterUrls([], 3600)).toEqual({});
    expect(createSignedUrls).not.toHaveBeenCalled();
  });
});

describe("remover", () => {
  it("remove as chaves e propaga erro do storage", async () => {
    remove.mockResolvedValueOnce({ data: [], error: null });
    await expect(remover(["a.jpg"])).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(["a.jpg"]);

    remove.mockResolvedValueOnce({ data: null, error: { message: "falhou" } });
    await expect(remover(["a.jpg"])).rejects.toThrow("falhou");
  });
});
