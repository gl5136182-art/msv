-- Ajustes do cadastro de item (SPEC §5, §6.1):
--   - categoria fixa (ativo/material) no lugar da tabela "categoria"; itens existentes viram "material";
--   - condição sem "usado_regular"; itens existentes com esse valor viram "usado_bom";
--   - segmento, RM (único), valor de depreciação mensal e dimensões e peso do lote.
-- "segmento" e "rm" ficam anuláveis só para os itens que já existem; o service exige os dois.

-- CreateEnum
CREATE TYPE "categoria_item" AS ENUM ('ativo', 'material');

-- CreateEnum
CREATE TYPE "segmento" AS ENUM ('industrial', 'facilities', 'logistica', 'mineracao', 'energia', 'oleo_gas');

-- AlterEnum: remove "usado_regular", levando os itens existentes para "usado_bom"
ALTER TYPE "estado" RENAME TO "estado_antigo";
CREATE TYPE "estado" AS ENUM ('novo', 'usado_bom', 'com_defeito');
ALTER TABLE "item" ALTER COLUMN "estado" TYPE "estado"
  USING (CASE WHEN "estado"::text = 'usado_regular' THEN 'usado_bom' ELSE "estado"::text END)::"estado";
DROP TYPE "estado_antigo";

-- DropForeignKey
ALTER TABLE "item" DROP CONSTRAINT "item_categoria_id_fkey";

-- DropIndex
DROP INDEX "item_categoria_id_idx";

-- AlterTable
ALTER TABLE "item"
  DROP COLUMN "categoria_id",
  ADD COLUMN "categoria" "categoria_item" NOT NULL DEFAULT 'material',
  ADD COLUMN "segmento" "segmento",
  ADD COLUMN "rm" VARCHAR(20),
  ADD COLUMN "valor_depreciacao_mensal" DECIMAL(14,2),
  ADD COLUMN "largura_lote_cm" DECIMAL(10,2),
  ADD COLUMN "altura_lote_cm" DECIMAL(10,2),
  ADD COLUMN "profundidade_lote_cm" DECIMAL(10,2),
  ADD COLUMN "peso_lote_kg" DECIMAL(10,2);

-- O padrão "material" só serve para preencher os itens existentes: a coluna não tem default no schema.
ALTER TABLE "item" ALTER COLUMN "categoria" DROP DEFAULT;

-- DropTable
DROP TABLE "categoria";

-- CreateIndex
CREATE UNIQUE INDEX "item_rm_key" ON "item"("rm");

-- CreateIndex
CREATE INDEX "item_categoria_idx" ON "item"("categoria");

-- CreateIndex
CREATE INDEX "item_segmento_idx" ON "item"("segmento");
