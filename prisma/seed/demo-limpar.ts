// Remove as UTs `DEMO-` e tudo ligado a elas (Fase 6, SPEC §9): notificações, fotos (banco e
// storage), itens, usuários (com sessões e contas) e as próprias UTs.
// Só apaga o que pertence a UTs `DEMO-`; os dados reais não são tocados.

import "dotenv/config";

import { db } from "@/infra/db";
import { remover } from "@/infra/storage";

import { PREFIXO_UT_DEMO } from "./demo-dados";

const LOTE_REMOCAO_STORAGE = 100;

async function limparDemo(): Promise<void> {
  const uts = await db.ut.findMany({
    where: { codigo: { startsWith: PREFIXO_UT_DEMO } },
    select: { id: true },
  });
  if (uts.length === 0) {
    console.log("seed:demo:limpar: não há UTs DEMO-, nada a fazer.");
    return;
  }
  const utIds = uts.map((ut) => ut.id);

  const [usuarios, itens] = await Promise.all([
    db.usuario.findMany({ where: { utId: { in: utIds } }, select: { id: true } }),
    db.item.findMany({ where: { utId: { in: utIds } }, select: { id: true } }),
  ]);
  const usuarioIds = usuarios.map((u) => u.id);
  const itemIds = itens.map((i) => i.id);

  const fotos = await db.itemFoto.findMany({
    where: { itemId: { in: itemIds } },
    select: { chave: true, chaveThumb: true },
  });
  const chaves = [...new Set(fotos.flatMap((f) => [f.chave, f.chaveThumb]))];

  const apagados = await db.$transaction(
    async (tx) => {
      const notificacoes = await tx.notificacao.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
      await tx.itemFoto.deleteMany({ where: { itemId: { in: itemIds } } });
      const itensApagados = await tx.item.deleteMany({ where: { id: { in: itemIds } } });
      // Sessões e contas saem em cascata com o usuário.
      const usuariosApagados = await tx.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
      const utsApagadas = await tx.ut.deleteMany({ where: { id: { in: utIds } } });

      return {
        notificacoes: notificacoes.count,
        itens: itensApagados.count,
        usuarios: usuariosApagados.count,
        uts: utsApagadas.count,
      };
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  for (let i = 0; i < chaves.length; i += LOTE_REMOCAO_STORAGE) {
    await remover(chaves.slice(i, i + LOTE_REMOCAO_STORAGE));
  }

  console.log(
    `seed:demo:limpar: removidos ${apagados.uts} UTs, ${apagados.usuarios} usuários, ${apagados.itens} itens, ${apagados.notificacoes} notificações e ${chaves.length} arquivos do storage.`,
  );
}

limparDemo()
  .then(() => db.$disconnect())
  .catch(async (erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    await db.$disconnect();
    process.exit(1);
  });
