// Carga do inventário do almoxarifado (planilha `INVENTARIO CONTAGEM.xlsx`) na UT BASE OPERACIONAL
// PARADAS, para dar uma visão mais real do valor parado e da economia possível.
//
//   npm run importar:inventario -- "C:\caminho\INVENTARIO CONTAGEM.xlsx" --dry-run   (só relatório)
//   npm run importar:inventario -- "C:\caminho\INVENTARIO CONTAGEM.xlsx"             (grava)
//   npm run importar:inventario:limpar                                              (desfaz)
//
// Regras (ver `inventario-xlsx.ts`): só entra linha com QTD > 0 e VALOR UNT; segmento Industrial,
// condição Usado bom, categoria Material, unidade un, sem dimensões. O LOCAL vai na descrição.
// É idempotente: o que já existe (mesmo id ou mesmo RM) é pulado, sem sobrescrever edições do app.
// As linhas ignoradas por falta de valor vão para `inventario-ignorados.csv`, ao lado da planilha.

import "dotenv/config";

import { writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import ExcelJS from "exceljs";

import {
  ignoradosParaCsv,
  interpretarInventario,
  ROTULO_MOTIVO,
  type Celula,
  type FamiliaFoto,
  type ItemInventario,
  type MotivoIgnorado,
} from "./inventario-xlsx";

const UT_CODIGO = "06.00.0171.256";
const TAMANHO_LOTE_UPLOAD = 40;

/** Fundos da foto genérica por família (paleta do `demo-fotos.ts`). */
const FUNDO_POR_FAMILIA: Record<FamiliaFoto, string> = {
  chave: "#c9d6db",
  tomada: "#e3d9a3",
  plugue: "#ffd7cc",
  outros: "#e2e2e2",
};

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inteiro = new Intl.NumberFormat("pt-BR");

/** Valor de uma célula do exceljs como texto, número ou nulo (fórmula → resultado salvo no arquivo). */
function valorDaCelula(valor: ExcelJS.CellValue): Celula {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "string" || typeof valor === "number") return valor;
  if (typeof valor === "boolean") return valor ? "1" : "0";
  if (valor instanceof Date) return valor.toISOString();
  if ("result" in valor) return valorDaCelula(valor.result as ExcelJS.CellValue);
  if ("richText" in valor) return valor.richText.map((parte) => parte.text).join("");
  if ("text" in valor) return String(valor.text);
  return null;
}

async function lerMatriz(caminho: string): Promise<Celula[][]> {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.readFile(caminho);
  const aba = livro.worksheets[0];
  if (!aba) throw new Error("A planilha não tem nenhuma aba.");

  const matriz: Celula[][] = [];
  for (let l = 1; l <= aba.rowCount; l++) {
    const linha = aba.getRow(l);
    const celulas: Celula[] = [];
    for (let c = 1; c <= aba.columnCount; c++) celulas.push(valorDaCelula(linha.getCell(c).value));
    matriz.push(celulas);
  }
  return matriz;
}

async function importar(): Promise<void> {
  const argumentos = process.argv.slice(2);
  const simular = argumentos.includes("--dry-run");
  const caminho = argumentos.find((a) => !a.startsWith("--"));
  if (!caminho) {
    throw new Error('Informe o caminho da planilha: npm run importar:inventario -- "C:\\...\\INVENTARIO CONTAGEM.xlsx"');
  }

  const { itens, ignorados } = interpretarInventario(await lerMatriz(caminho));

  const porMotivo = new Map<MotivoIgnorado, number>();
  for (const i of ignorados) porMotivo.set(i.motivo, (porMotivo.get(i.motivo) ?? 0) + 1);
  const unidades = itens.reduce((soma, i) => soma + i.quantidade, 0);
  const valorTotal = itens.reduce((soma, i) => soma + i.quantidade * i.valorUnitarioReposicao, 0);
  const semRm = itens.filter((i) => i.rm === null).length;

  console.log(`importar:inventario: ${basename(caminho)}`);
  console.log(`  importáveis:  ${itens.length} itens, ${inteiro.format(unidades)} un, ${moeda.format(valorTotal)} de reposição`);
  console.log(`  sem RM:       ${semRm} (entram com RM em branco, para completar no app)`);
  for (const [motivo, quantidade] of porMotivo) {
    console.log(`  ignoradas:    ${quantidade} (${ROTULO_MOTIVO[motivo]})`);
  }

  const paraCompletar = ignorados.filter((i) => i.motivo !== "sem_quantidade");
  if (paraCompletar.length > 0) {
    const arquivo = join(dirname(caminho), "inventario-ignorados.csv");
    writeFileSync(arquivo, ignoradosParaCsv(paraCompletar), "utf8");
    console.log(`  relatório:    ${paraCompletar.length} linhas para completar em ${arquivo}`);
  }

  if (simular) {
    console.log("importar:inventario: --dry-run, nada foi gravado.");
    return;
  }
  if (itens.length === 0) {
    console.log("importar:inventario: nada a importar.");
    return;
  }

  // Imports tardios: o relatório acima não precisa de banco nem de storage.
  const { db } = await import("@/infra/db");
  const { criarUrlsUpload, remover } = await import("@/infra/storage");
  const { gerarChavesFoto } = await import("@/lib/chaves-foto");
  const { montarBuscaNormalizada } = await import("@/modules/itens/itens.service");
  const { enviar, gerarFotoGenerica } = await import("./demo-fotos");

  try {
    const ut = await db.ut.findUnique({ where: { codigo: UT_CODIGO }, select: { id: true, nome: true } });
    if (!ut) throw new Error(`UT ${UT_CODIGO} não encontrada. Rode "npm run seed" antes.`);

    const criador =
      (await db.usuario.findFirst({
        where: { utId: ut.id, papel: "almoxarife", ativo: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })) ??
      (await db.usuario.findFirst({
        where: { papel: "admin", ativo: true, ...(process.env.SEED_ADMIN_EMAIL ? { email: process.env.SEED_ADMIN_EMAIL.trim().toLowerCase() } : {}) },
        select: { id: true },
      }));
    if (!criador) throw new Error("Não achei um almoxarife da UT nem um admin para constar como criador. Rode \"npm run seed\".");

    const rmsDaPlanilha = itens.flatMap((i) => (i.rm ? [i.rm] : []));
    const existentes = await db.item.findMany({
      where: { OR: [{ id: { in: itens.map((i) => i.id) } }, { rm: { in: rmsDaPlanilha } }] },
      select: { id: true, rm: true },
    });
    const idsExistentes = new Set(existentes.map((e) => e.id));
    const rmsExistentes = new Set(existentes.flatMap((e) => (e.rm ? [e.rm] : [])));
    const novos: ItemInventario[] = itens.filter(
      (i) => !idsExistentes.has(i.id) && !(i.rm && rmsExistentes.has(i.rm)),
    );
    console.log(`importar:inventario: ${itens.length - novos.length} já existiam (pulados), ${novos.length} a criar em ${ut.nome}.`);
    if (novos.length === 0) return;

    // Fotos: uma imagem por família, mas chaves próprias por item (o `editarItem` remove do storage
    // a foto trocada; chave compartilhada quebraria a capa dos outros itens).
    const agora = new Date();
    const imagens = new Map<FamiliaFoto, Awaited<ReturnType<typeof gerarFotoGenerica>>>();
    for (const familia of new Set(novos.map((i) => i.familia))) {
      imagens.set(familia, await gerarFotoGenerica(FUNDO_POR_FAMILIA[familia]));
    }

    const fotos = new Map<string, { chave: string; chaveThumb: string }>();
    const enviadas: string[] = [];
    try {
      for (let inicio = 0; inicio < novos.length; inicio += TAMANHO_LOTE_UPLOAD) {
        const lote = novos.slice(inicio, inicio + TAMANHO_LOTE_UPLOAD);
        const chaves = lote.map(() => gerarChavesFoto(agora));
        const urls = await criarUrlsUpload(chaves.flatMap((c) => [c.chave, c.chaveThumb]));

        await Promise.all(
          lote.map(async (item, i) => {
            const imagem = imagens.get(item.familia)!;
            await enviar(urls[i * 2].url, imagem.principal);
            await enviar(urls[i * 2 + 1].url, imagem.miniatura);
            enviadas.push(chaves[i].chave, chaves[i].chaveThumb);
            fotos.set(item.id, chaves[i]);
          }),
        );
        console.log(`importar:inventario: fotos enviadas ${Math.min(inicio + lote.length, novos.length)}/${novos.length}`);
      }

      await db.$transaction(
        async (tx) => {
          await tx.item.createMany({
            data: novos.map((i) => ({
              id: i.id,
              utId: ut.id,
              criadoPorId: criador.id,
              categoria: "material" as const,
              segmento: "industrial" as const,
              rm: i.rm,
              nome: i.nome,
              marca: i.marca,
              modelo: i.modelo,
              descricao: i.descricao,
              estado: "usado_bom" as const,
              unidade: "un" as const,
              quantidadeTotal: i.quantidade,
              quantidadeDisponivel: i.quantidade,
              valorUnitarioReposicao: i.valorUnitarioReposicao,
              dimensoesOrigem: "manual" as const,
              buscaNormalizada: montarBuscaNormalizada({
                nome: i.nome,
                marca: i.marca,
                modelo: i.modelo,
                rm: i.rm,
                categoria: "material",
                segmento: "industrial",
                descricao: i.descricao,
              }),
              status: "disponivel" as const,
            })),
          });
          await tx.itemFoto.createMany({
            data: novos.map((i) => ({ itemId: i.id, ordem: 0, ...fotos.get(i.id)! })),
          });
        },
        { timeout: 120_000, maxWait: 30_000 },
      );
    } catch (erro) {
      // Não deixa arquivo órfão se o banco recusar a carga.
      if (enviadas.length > 0) await remover(enviadas).catch(() => undefined);
      throw erro;
    }

    const valorNovos = novos.reduce((soma, i) => soma + i.quantidade * i.valorUnitarioReposicao, 0);
    console.log(`importar:inventario: ${novos.length} itens criados (${moeda.format(valorNovos)} de reposição).`);
  } finally {
    await db.$disconnect();
  }
}

importar().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
