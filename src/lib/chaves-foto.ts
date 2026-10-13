// Chaves das fotos no storage (CLAUDE.md, Portabilidade):
//   fotos/{aaaa}/{mm}/{uuid}.jpg        principal
//   fotos/{aaaa}/{mm}/{uuid}_thumb.jpg  miniatura
// O banco guarda só a chave; a URL é sempre assinada na hora. Função pura (ano/mês em UTC).

export type ChavesFoto = { chave: string; chaveThumb: string };

export function gerarChavesFoto(agora: Date = new Date(), uuid: string = crypto.randomUUID()): ChavesFoto {
  const ano = String(agora.getUTCFullYear());
  const mes = String(agora.getUTCMonth() + 1).padStart(2, "0");
  const base = `fotos/${ano}/${mes}/${uuid}`;
  return { chave: `${base}.jpg`, chaveThumb: `${base}_thumb.jpg` };
}

const PADRAO_CHAVE = /^fotos\/\d{4}\/\d{2}\/[0-9a-f-]{36}(_thumb)?\.jpg$/;

/** `true` se a chave tem o formato gerado por `gerarChavesFoto` (evita gravar chave arbitrária). */
export function chaveFotoValida(chave: string): boolean {
  return PADRAO_CHAVE.test(chave);
}
