// Aplica uma foto de `prisma/seed/fotos-reais/` aos itens `inv-*` de uma marca e prefixo de nome.
//
//   npm run fotos:aplicar -- --arquivo tramontina_combinada.jpg --marca TRAMONTINA-PRO --prefixo "CHAVE COMBINADA" [--modelo X] [--dry-run]
//
// Cada item recebe chaves próprias no storage; as fotos antigas são removidas após a troca gravada.

import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

const FUNDO = "#ffffff";
const TAMANHO_LOTE = 5;
const TENTATIVAS = 4;

function arg(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function comTentativas<T>(chamada: () => Promise<T>): Promise<T> {
  for (let t = 1; ; t++) {
    try {
      return await chamada();
    } catch (erro) {
      if (t >= TENTATIVAS) throw erro;
      await new Promise((r) => setTimeout(r, 1500 * t));
    }
  }
}

async function main() {
  const arquivo = arg("arquivo");
  const marca = arg("marca");
  const prefixo = arg("prefixo");
  const modelo = arg("modelo");
  if (!arquivo || !marca || !prefixo) throw new Error("Informe --arquivo, --marca e --prefixo.");
  const simular = process.argv.includes("--dry-run");

  const { db } = await import("@/infra/db");
  const { criarUrlsUpload, remover } = await import("@/infra/storage");
  const { gerarChavesFoto } = await import("@/lib/chaves-foto");
  const { enviar } = await import("./demo-fotos");

  try {
    const alvos = await db.item.findMany({
      where: {
        id: { startsWith: "inv-" },
        marca: { equals: marca, mode: "insensitive" },
        nome: { startsWith: prefixo, mode: "insensitive" },
        ...(modelo ? { modelo: { equals: modelo, mode: "insensitive" } } : {}),
      },
      select: { id: true, fotos: { select: { chave: true, chaveThumb: true } } },
    });
    console.log(`fotos:aplicar: ${alvos.length} itens (${marca} / ${prefixo}${modelo ? ` / ${modelo}` : ""}) com ${arquivo}.`);
    if (simular || alvos.length === 0) return;

    const origem = readFileSync(join(process.cwd(), "prisma", "seed", "fotos-reais", arquivo));
    const quadro = (l: number, a: number, q: number) =>
      sharp(origem).rotate().resize(l, a, { fit: "contain", background: FUNDO }).flatten({ background: FUNDO }).jpeg({ quality: q }).toBuffer();
    const principal = await quadro(800, 600, 82);
    const miniatura = await quadro(400, 300, 72);

    const agora = new Date();
    let feitos = 0;
    for (let inicio = 0; inicio < alvos.length; inicio += TAMANHO_LOTE) {
      const lote = alvos.slice(inicio, inicio + TAMANHO_LOTE);
      const chaves = lote.map(() => gerarChavesFoto(agora));
      const novas = chaves.flatMap((c) => [c.chave, c.chaveThumb]);
      try {
        const urls: Awaited<ReturnType<typeof criarUrlsUpload>> = [];
        for (const chave of novas) urls.push(...(await comTentativas(() => criarUrlsUpload([chave]))));
        for (let i = 0; i < lote.length; i++) {
          await comTentativas(() => enviar(urls[i * 2].url, principal));
          await comTentativas(() => enviar(urls[i * 2 + 1].url, miniatura));
        }
        await db.$transaction([
          db.itemFoto.deleteMany({ where: { itemId: { in: lote.map((l) => l.id) } } }),
          db.itemFoto.createMany({ data: lote.map((l, n) => ({ itemId: l.id, ordem: 0, ...chaves[n] })) }),
        ]);
      } catch (erro) {
        await remover(novas).catch(() => undefined);
        console.error(`fotos:aplicar: falhou no lote ${inicio + 1}; ${feitos} já trocados.`);
        throw erro;
      }
      await remover(lote.flatMap((l) => l.fotos.flatMap((f) => [f.chave, f.chaveThumb]))).catch(() => undefined);
      feitos += lote.length;
      console.log(`fotos:aplicar: ${feitos}/${alvos.length}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
