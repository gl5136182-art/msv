// Seed de demonstração (Fase 6, SPEC §9): 12 UTs `DEMO-`, ≈150 itens com fotos genéricas e
// ≈60 solicitações concluídas em 12 meses. Só cria dados em UTs `DEMO-`; as UTs reais não
// recebem nada. Para repetir, rode `npm run seed:demo:limpar` antes.
//
// Os usuários de demonstração não têm conta (senha): existem só como donos dos itens e autores das
// solicitações. Para ver o dashboard, entre como admin ("Todas as UTs").

import "dotenv/config";

import { db } from "@/infra/db";
import { montarBuscaNormalizada } from "@/modules/itens/itens.service";

import { gerarConjuntoDemo, PREFIXO_UT_DEMO } from "./demo-dados";
import { enviarFotosGenericas } from "./demo-fotos";

async function semearDemo(): Promise<void> {
  const existentes = await db.ut.count({ where: { codigo: { startsWith: PREFIXO_UT_DEMO } } });
  if (existentes > 0) {
    throw new Error(
      `Já existem ${existentes} UTs ${PREFIXO_UT_DEMO}. Rode "npm run seed:demo:limpar" antes de semear de novo.`,
    );
  }

  const agora = new Date();
  const conjunto = gerarConjuntoDemo(agora);

  console.log("seed:demo: enviando as fotos genéricas ao storage…");
  const fotos = await enviarFotosGenericas(conjunto.quantidadeFotosGenericas, agora);

  await db.$transaction(
    async (tx) => {
      await tx.ut.createMany({ data: conjunto.uts });
      const uts = await tx.ut.findMany({
        where: { codigo: { startsWith: PREFIXO_UT_DEMO } },
        select: { id: true, codigo: true },
      });
      const utId = new Map(uts.map((ut) => [ut.codigo, ut.id]));
      const idDaUt = (codigo: string): string => {
        const id = utId.get(codigo);
        if (!id) throw new Error(`UT ${codigo} não encontrada.`);
        return id;
      };

      await tx.usuario.createMany({
        data: conjunto.usuarios.map((u) => ({
          id: u.id,
          name: u.nome,
          email: u.email,
          emailVerified: true,
          cpf: u.cpf,
          papel: u.papel,
          utId: idDaUt(u.utCodigo),
          telefone: u.telefone,
          ativo: true,
          deveTrocarSenha: false,
        })),
      });

      await tx.item.createMany({
        data: conjunto.itens.map((i) => ({
          id: i.id,
          utId: idDaUt(i.utCodigo),
          criadoPorId: i.criadoPorId,
          categoria: i.categoria,
          segmento: i.segmento,
          rm: i.rm,
          nome: i.nome,
          marca: i.marca,
          modelo: i.modelo,
          descricao: i.descricao,
          estado: i.estado,
          unidade: i.unidade,
          quantidadeTotal: i.quantidadeTotal,
          quantidadeDisponivel: i.quantidadeDisponivel,
          valorUnitarioReposicao: i.valorUnitarioReposicao,
          valorDepreciacaoMensal: i.valorDepreciacaoMensal,
          larguraCm: i.larguraCm,
          alturaCm: i.alturaCm,
          profundidadeCm: i.profundidadeCm,
          pesoKg: i.pesoKg,
          larguraLoteCm: i.lote?.larguraCm ?? null,
          alturaLoteCm: i.lote?.alturaCm ?? null,
          profundidadeLoteCm: i.lote?.profundidadeCm ?? null,
          pesoLoteKg: i.lote?.pesoKg ?? null,
          dimensoesOrigem: "manual" as const,
          buscaNormalizada: montarBuscaNormalizada(i),
          status: i.status,
          criadoEm: i.criadoEm,
        })),
      });

      await tx.itemFoto.createMany({
        data: conjunto.itens.flatMap((i) =>
          i.fotos.map((indice, ordem) => ({
            itemId: i.id,
            chave: fotos[indice].chave,
            chaveThumb: fotos[indice].chaveThumb,
            ordem,
          })),
        ),
      });

      await tx.solicitacao.createMany({
        data: conjunto.solicitacoes.map((s) => ({
          id: s.id,
          itemId: s.itemId,
          solicitanteId: s.solicitanteId,
          utDestinoId: idDaUt(s.utDestinoCodigo),
          quantidade: s.quantidade,
          observacao: s.observacao,
          status: "concluida" as const,
          valorUnitarioSnapshot: s.valorUnitarioSnapshot,
          custoFrete: s.custoFrete,
          respondidaPorId: s.respondidaPorId,
          respondidaEm: s.respondidaEm,
          concluidaPorId: s.concluidaPorId,
          concluidaEm: s.concluidaEm,
          criadoEm: s.criadoEm,
        })),
      });
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  console.log(
    `seed:demo: ${conjunto.uts.length} UTs, ${conjunto.usuarios.length} usuários, ${conjunto.itens.length} itens e ${conjunto.solicitacoes.length} solicitações concluídas criados.`,
  );
}

semearDemo()
  .then(() => db.$disconnect())
  .catch(async (erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    await db.$disconnect();
    process.exit(1);
  });
