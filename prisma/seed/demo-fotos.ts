// Fotos genéricas dos itens de demonstração: imagens desenhadas aqui mesmo (uma caixa em
// perspectiva sobre fundos neutros da paleta), enviadas ao bucket por URL assinada. Cada execução
// do seed gera chaves novas; os itens `demo-*` compartilham as mesmas poucas imagens, e o
// `seed:demo:limpar` remove as chaves lendo as fotos dos itens `DEMO-`.

import sharp from "sharp";

import { criarUrlsUpload } from "@/infra/storage";
import { gerarChavesFoto, type ChavesFoto } from "@/lib/chaves-foto";

const FUNDOS = ["#e2e2e2", "#f2f2f2", "#e3d9a3", "#c9d6db", "#ffd7cc", "#d9cbd3"];
const TRACO = "#232323";

function svg(fundo: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${fundo}"/>
  <g fill="none" stroke="${TRACO}" stroke-width="10" stroke-linejoin="miter">
    <path d="M300 230 L400 180 L500 230 L500 370 L400 420 L300 370 Z"/>
    <path d="M300 230 L400 280 L500 230 M400 280 L400 420"/>
  </g>
</svg>`;
}

async function enviar(url: string, arquivo: Buffer): Promise<void> {
  const resposta = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array(arquivo),
  });
  if (!resposta.ok) {
    throw new Error(`Falha ao enviar a foto de demonstração (HTTP ${resposta.status}).`);
  }
}

/** Gera e envia `quantidade` fotos genéricas (principal 800×600 e miniatura 400×300). */
export async function enviarFotosGenericas(quantidade: number, agora: Date): Promise<ChavesFoto[]> {
  const fotos: ChavesFoto[] = [];

  for (let i = 0; i < quantidade; i++) {
    const base = sharp(Buffer.from(svg(FUNDOS[i % FUNDOS.length])));
    const principal = await base.clone().jpeg({ quality: 80 }).toBuffer();
    const miniatura = await base.clone().resize(400, 300).jpeg({ quality: 70 }).toBuffer();

    const chaves = gerarChavesFoto(agora);
    const [urlPrincipal, urlMiniatura] = await criarUrlsUpload([chaves.chave, chaves.chaveThumb]);
    await enviar(urlPrincipal.url, principal);
    await enviar(urlMiniatura.url, miniatura);
    fotos.push(chaves);
  }

  return fotos;
}
