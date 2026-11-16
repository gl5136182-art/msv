-- AlterEnum
ALTER TYPE "status_item" ADD VALUE 'transferido';

-- CreateTable
CREATE TABLE "item_transferencia" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "registrado_por_id" TEXT NOT NULL,
    "destino" VARCHAR(200) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_transferencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_transferencia_item_id_idx" ON "item_transferencia"("item_id");

-- AddForeignKey
ALTER TABLE "item_transferencia" ADD CONSTRAINT "item_transferencia_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_transferencia" ADD CONSTRAINT "item_transferencia_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
