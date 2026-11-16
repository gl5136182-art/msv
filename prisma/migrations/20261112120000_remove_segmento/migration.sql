DROP INDEX IF EXISTS "item_segmento_idx";
ALTER TABLE "item" DROP COLUMN "segmento";
DROP TYPE "segmento";
