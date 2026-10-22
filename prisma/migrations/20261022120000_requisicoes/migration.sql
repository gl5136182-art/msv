-- Requisições de compra com recomendação de reuso pela IA (SPEC §6.6).

-- CreateEnum
CREATE TYPE "status_requisicao" AS ENUM ('rascunho', 'aberta', 'atendida_reuso', 'parcial', 'enviada_compra', 'cancelada');

-- CreateTable
CREATE TABLE "requisicao" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "ut_id" TEXT NOT NULL,
    "justificativa" VARCHAR(500),
    "status" "status_requisicao" NOT NULL DEFAULT 'rascunho',
    "analisada_em" TIMESTAMP(3),
    "analise_com_ia" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisicao_linha" (
    "id" TEXT NOT NULL,
    "requisicao_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" VARCHAR(300) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "unidade" "unidade" NOT NULL,
    "observacao" VARCHAR(300),

    CONSTRAINT "requisicao_linha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requisicao_recomendacao" (
    "id" TEXT NOT NULL,
    "linha_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "quantidade_sugerida" INTEGER NOT NULL,
    "aderencia" VARCHAR(10) NOT NULL,
    "justificativa" VARCHAR(300) NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "requisicao_recomendacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requisicao_numero_key" ON "requisicao"("numero");

-- CreateIndex
CREATE INDEX "requisicao_solicitante_id_idx" ON "requisicao"("solicitante_id");

-- CreateIndex
CREATE INDEX "requisicao_ut_id_status_idx" ON "requisicao"("ut_id", "status");

-- CreateIndex
CREATE INDEX "requisicao_solicitante_id_analisada_em_idx" ON "requisicao"("solicitante_id", "analisada_em");

-- CreateIndex
CREATE INDEX "requisicao_linha_requisicao_id_idx" ON "requisicao_linha"("requisicao_id");

-- CreateIndex
CREATE INDEX "requisicao_recomendacao_linha_id_idx" ON "requisicao_recomendacao"("linha_id");

-- CreateIndex
CREATE INDEX "requisicao_recomendacao_item_id_idx" ON "requisicao_recomendacao"("item_id");

-- AddForeignKey
ALTER TABLE "requisicao" ADD CONSTRAINT "requisicao_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicao" ADD CONSTRAINT "requisicao_ut_id_fkey" FOREIGN KEY ("ut_id") REFERENCES "ut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicao_linha" ADD CONSTRAINT "requisicao_linha_requisicao_id_fkey" FOREIGN KEY ("requisicao_id") REFERENCES "requisicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicao_recomendacao" ADD CONSTRAINT "requisicao_recomendacao_linha_id_fkey" FOREIGN KEY ("linha_id") REFERENCES "requisicao_linha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisicao_recomendacao" ADD CONSTRAINT "requisicao_recomendacao_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

