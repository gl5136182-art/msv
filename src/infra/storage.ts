import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Storage de arquivos (fotos dos itens). ÚNICO lugar com `@supabase/supabase-js` (CLAUDE.md,
// Portabilidade): na migração para a infra Manserv, só este arquivo muda, mantendo as 3 funções.
//
// Regras:
// - bucket privado, acesso só por URL assinada;
// - a service role key fica só no servidor;
// - o banco guarda a CHAVE (`fotos/{aaaa}/{mm}/{uuid}.jpg`), nunca a URL.

/** Uma chave e a URL assinada para o navegador enviar o arquivo a ela. */
export type UrlUpload = { chave: string; url: string };

/** Chave → URL assinada de leitura. Chaves sem arquivo (ou com erro) ficam de fora. */
export type UrlsPorChave = Record<string, string>;

const globalParaStorage = globalThis as unknown as { supabaseStorage?: SupabaseClient };

function obterBucket(): { cliente: SupabaseClient; bucket: string } {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET;
  if (!url || !chave || !bucket) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_BUCKET são obrigatórias. Veja .env.example.");
  }
  // Criado sob demanda: importar este módulo não exige as variáveis (ex.: `next build` sem .env).
  globalParaStorage.supabaseStorage ??= createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { cliente: globalParaStorage.supabaseStorage, bucket };
}

/**
 * Gera uma URL assinada de upload por chave. O navegador envia o arquivo com `PUT` nessa URL,
 * com o próprio arquivo no corpo e o `Content-Type` dele. Cada chave só pode ser gravada uma vez.
 */
export async function criarUrlsUpload(chaves: string[]): Promise<UrlUpload[]> {
  if (chaves.length === 0) return [];
  const { cliente, bucket } = obterBucket();
  return Promise.all(
    chaves.map(async (chave) => {
      const { data, error } = await cliente.storage.from(bucket).createSignedUploadUrl(chave);
      if (error || !data) {
        throw new Error(`Não foi possível preparar o envio do arquivo: ${error?.message ?? "sem resposta"}`);
      }
      return { chave, url: data.signedUrl };
    }),
  );
}

/** Gera, em lote, as URLs assinadas de leitura, válidas por `expiraEmSeg` segundos. */
export async function obterUrls(chaves: string[], expiraEmSeg: number): Promise<UrlsPorChave> {
  const unicas = [...new Set(chaves)];
  if (unicas.length === 0) return {};
  const { cliente, bucket } = obterBucket();
  const { data, error } = await cliente.storage.from(bucket).createSignedUrls(unicas, expiraEmSeg);
  if (error || !data) {
    throw new Error(`Não foi possível obter os arquivos: ${error?.message ?? "sem resposta"}`);
  }
  const urls: UrlsPorChave = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}

/** Remove os arquivos do bucket. Chaves inexistentes são ignoradas. */
export async function remover(chaves: string[]): Promise<void> {
  if (chaves.length === 0) return;
  const { cliente, bucket } = obterBucket();
  const { error } = await cliente.storage.from(bucket).remove(chaves);
  if (error) {
    throw new Error(`Não foi possível remover os arquivos: ${error.message}`);
  }
}
