// Troca as fotos genéricas dos itens do inventário (`inv-*`) por fotos reais por tipo de produto,
// guardadas em `prisma/seed/fotos-reais/` (créditos em CREDITOS.md).
//
//   npm run fotos:reais -- --dry-run   (só conta)
//   npm run fotos:reais                (grava)
//
// Cada item recebe chaves próprias no storage (o `editarItem` remove do storage a foto trocada;
// chave compartilhada quebraria a capa dos outros). As fotos antigas são removidas depois que a
// troca é gravada. Itens já trocados ficam registrados em um arquivo temporário e são pulados.

import "dotenv/config";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";

const PASTA = join(process.cwd(), "prisma", "seed", "fotos-reais");
const REGISTRO = join(tmpdir(), "msv-fotos-reais-feitas.json");
const TAMANHO_LOTE = 5;
const TENTATIVAS = 4;
const FUNDO = "#f2f2f2";

/** Prefixo do nome (sem acento/caixa) → arquivo. O mais específico vem primeiro. */
const TIPOS: { prefixo: string; arquivo: string }[] = [
  { prefixo: "CHAVE ESPINA ESTRIADA", arquivo: "estriada.png" },
  { prefixo: "CHAVE ESPINA FIXA", arquivo: "espinha_fixa.jpg" },
  { prefixo: "CHAVE DE BATER BOCA", arquivo: "espinha_fixa.jpg" },
  { prefixo: "CHAVE COMBINADA", arquivo: "combinada.jpg" },
  { prefixo: "PLUGUE", arquivo: "plugue.jpg" },
];

async function comTentativas<T>(chamada: () => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await chamada();
    } catch (erro) {
      if (tentativa >= TENTATIVAS) throw erro;
      await new Promise((r) => setTimeout(r, 1500 * tentativa));
    }
  }
}

async function preparar(arquivo: string): Promise<{ principal: Buffer; miniatura: Buffer }> {
  const origem = readFileSync(join(PASTA, arquivo));
  const quadro = (largura: number, altura: number, qualidade: number) =>
    sharp(origem)
      .rotate()
      .resize(largura, altura, { fit: "contain", background: FUNDO })
      .flatten({ background: FUNDO })
      .jpeg({ quality: qualidade })
      .toBuffer();
  return { principal: await quadro(800, 600, 82), miniatura: await quadro(400, 300, 72) };
}

async function trocar(): Promise<void> {
  const simular = process.argv.includes("--dry-run");

  const { db } = await import("@/infra/db");
  const { criarUrlsUpload, remover } = await import("@/infra/storage");
  const { gerarChavesFoto } = await import("@/lib/chaves-foto");
  const { enviar } = await import("./demo-fotos");

  try {
    const feitos = new Set<string>(existsSync(REGISTRO) ? (JSON.parse(readFileSync(REGISTRO, "utf8")) as string[]) : []);
    const itens = await db.item.findMany({
      where: { id: { startsWith: "inv-" } },
      select: { id: true, nome: true, fotos: { select: { chave: true, chaveThumb: true } } },
      orderBy: { id: "asc" },
    });

    const alvos = itens.flatMap((item) => {
      const tipo = TIPOS.find((t) => item.nome.toUpperCase().startsWith(t.prefixo));
      return tipo && !feitos.has(item.id) ? [{ item, arquivo: tipo.arquivo }] : [];
    });
    const porArquivo = new Map<string, number>();
    for (const a of alvos) porArquivo.set(a.arquivo, (porArquivo.get(a.arquivo) ?? 0) + 1);
    console.log(`fotos:reais: ${alvos.length} itens a trocar (${itens.length - alvos.length} sem foto nova ou já feitos).`);
    for (const [arquivo, n] of porArquivo) console.log(`  ${arquivo}: ${n}`);
    if (simular || alvos.length === 0) return;

    const imagens = new Map<string, Awaited<ReturnType<typeof preparar>>>();
    for (const arquivo of porArquivo.keys()) imagens.set(arquivo, await preparar(arquivo));

    const agora = new Date();
    let trocados = 0;
    for (let inicio = 0; inicio < alvos.length; inicio += TAMANHO_LOTE) {
      const lote = alvos.slice(inicio, inicio + TAMANHO_LOTE);
      const chaves = lote.map(() => gerarChavesFoto(agora));
      const novas = chaves.flatMap((c) => [c.chave, c.chaveThumb]);

      try {
        const urls: Awaited<ReturnType<typeof criarUrlsUpload>> = [];
        for (const chave of novas) urls.push(...(await comTentativas(() => criarUrlsUpload([chave]))));
        for (const [i, { arquivo }] of lote.entries()) {
          const imagem = imagens.get(arquivo)!;
          await comTentativas(() => enviar(urls[i * 2].url, imagem.principal));
          await comTentativas(() => enviar(urls[i * 2 + 1].url, imagem.miniatura));
        }
        await db.$transaction([
          db.itemFoto.deleteMany({ where: { itemId: { in: lote.map((l) => l.item.id) } } }),
          db.itemFoto.createMany({ data: lote.map((l, n) => ({ itemId: l.item.id, ordem: 0, ...chaves[n] })) }),
        ]);
      } catch (erro) {
        await remover(novas).catch(() => undefined);
        console.error(`fotos:reais: falhou no lote que começa no item ${inicio + 1}; ${trocados} já trocados. Rode de novo para continuar.`);
        throw erro;
      }

      for (const l of lote) feitos.add(l.item.id);
      writeFileSync(REGISTRO, JSON.stringify([...feitos]), "utf8");
      // Fotos genéricas antigas: só depois de a troca estar gravada.
      const antigas = lote.flatMap((l) => l.item.fotos.flatMap((f) => [f.chave, f.chaveThumb]));
      await remover(antigas).catch(() => console.warn("fotos:reais: não consegui remover algumas fotos antigas do storage."));

      trocados += lote.length;
      console.log(`fotos:reais: ${trocados}/${alvos.length}`);
    }
    console.log(`fotos:reais: ${trocados} itens com foto nova.`);
  } finally {
    await db.$disconnect();
  }
}

trocar().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
