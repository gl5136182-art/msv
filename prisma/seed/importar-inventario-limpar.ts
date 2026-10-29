// Desfaz a carga do inventário: remove os itens `inv-*` (e as fotos, no banco e no storage).
// Só toca nos itens criados por `importar-inventario.ts`.

import "dotenv/config";

import { db } from "@/infra/db";
import { remover } from "@/infra/storage";

import { PREFIXO_ID_INVENTARIO } from "./inventario-xlsx";

const LOTE_REMOCAO_STORAGE = 100;

async function limpar(): Promise<void> {
  const itens = await db.item.findMany({
    where: { id: { startsWith: PREFIXO_ID_INVENTARIO } },
    select: { id: true },
  });
  if (itens.length === 0) {
    console.log("importar:inventario:limpar: não há itens do inventário, nada a fazer.");
    return;
  }
  const itemIds = itens.map((i) => i.id);

  const fotos = await db.itemFoto.findMany({
    where: { itemId: { in: itemIds } },
    select: { chave: true, chaveThumb: true },
  });
  const chaves = [...new Set(fotos.flatMap((f) => [f.chave, f.chaveThumb]))];

  await db.$transaction(
    async (tx) => {
      await tx.itemFoto.deleteMany({ where: { itemId: { in: itemIds } } });
      await tx.item.deleteMany({ where: { id: { in: itemIds } } });
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  for (let i = 0; i < chaves.length; i += LOTE_REMOCAO_STORAGE) {
    await remover(chaves.slice(i, i + LOTE_REMOCAO_STORAGE));
  }

  console.log(
    `importar:inventario:limpar: removidos ${itemIds.length} itens e ${chaves.length} arquivos do storage.`,
  );
}

limpar()
  .then(() => db.$disconnect())
  .catch(async (erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    await db.$disconnect();
    process.exit(1);
  });
