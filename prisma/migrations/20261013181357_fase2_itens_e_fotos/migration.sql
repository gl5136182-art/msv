-- CreateEnum
CREATE TYPE "estado" AS ENUM ('novo', 'usado_bom', 'usado_regular', 'com_defeito');

-- CreateEnum
CREATE TYPE "unidade" AS ENUM ('un', 'cx', 'kg', 'm', 'l', 'par', 'jogo');

-- CreateEnum
CREATE TYPE "status_item" AS ENUM ('disponivel', 'esgotado', 'arquivado');

-- CreateEnum
CREATE TYPE "dimensoes_origem" AS ENUM ('manual', 'ia', 'ia_ajustada');

-- CreateTable
CREATE TABLE "item" (
    "id" TEXT NOT NULL,
    "ut_id" TEXT NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "marca" VARCHAR(100) NOT NULL,
    "modelo" VARCHAR(100) NOT NULL,
    "descricao" TEXT,
    "estado" "estado" NOT NULL,
    "unidade" "unidade" NOT NULL,
    "quantidade_total" INTEGER NOT NULL,
    "quantidade_disponivel" INTEGER NOT NULL,
    "valor_unitario_reposicao" DECIMAL(14,2) NOT NULL,
    "largura_cm" DECIMAL(10,2) NOT NULL,
    "altura_cm" DECIMAL(10,2) NOT NULL,
    "profundidade_cm" DECIMAL(10,2) NOT NULL,
    "peso_kg" DECIMAL(10,2) NOT NULL,
    "dimensoes_origem" "dimensoes_origem" NOT NULL DEFAULT 'manual',
    "ia_resposta" TEXT,
    "busca_normalizada" VARCHAR(500) NOT NULL,
    "status" "status_item" NOT NULL DEFAULT 'disponivel',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_foto" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "chave" VARCHAR(255) NOT NULL,
    "chave_thumb" VARCHAR(255) NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "item_foto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_status_ut_id_idx" ON "item"("status", "ut_id");

-- CreateIndex
CREATE INDEX "item_categoria_id_idx" ON "item"("categoria_id");

-- CreateIndex
CREATE INDEX "item_foto_item_id_idx" ON "item_foto"("item_id");

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_ut_id_fkey" FOREIGN KEY ("ut_id") REFERENCES "ut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_foto" ADD CONSTRAINT "item_foto_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
