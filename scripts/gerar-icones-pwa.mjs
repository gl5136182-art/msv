// Gera os PNGs do PWA em public/icons/ a partir do símbolo oficial (DESIGN §9):
// símbolo branco sobre fundo #ff460a. Não redesenha a marca: só rasteriza public/brand/manserv-simbolo.svg.
// Uso: npm run icones:pwa
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origem = path.join(raiz, "public/brand/manserv-simbolo.svg");
const destino = path.join(raiz, "public/icons");

const LARANJA = "#ff460a";

// `largura`: fração da largura do ícone ocupada pelo símbolo. O símbolo é largo (≈2,2:1);
// no maskable ele precisa caber no círculo central de 80% (safe zone), por isso a margem maior.
const icones = [
  { arquivo: "icon-192.png", tamanho: 192, largura: 0.76 },
  { arquivo: "icon-512.png", tamanho: 512, largura: 0.76 },
  { arquivo: "icon-maskable-512.png", tamanho: 512, largura: 0.6 },
  { arquivo: "apple-touch-icon.png", tamanho: 180, largura: 0.7 },
];

const svg = (await readFile(origem, "utf8")).replaceAll("currentColor", "#ffffff");

await mkdir(destino, { recursive: true });

for (const { arquivo, tamanho, largura } of icones) {
  const simbolo = await sharp(Buffer.from(svg), { density: 600 })
    .resize({ width: Math.round(tamanho * largura) })
    .png()
    .toBuffer();

  await sharp({
    create: { width: tamanho, height: tamanho, channels: 3, background: LARANJA },
  })
    .composite([{ input: simbolo, gravity: "center" }])
    .png()
    .toFile(path.join(destino, arquivo));

  console.log(`public/icons/${arquivo} (${tamanho}x${tamanho})`);
}
