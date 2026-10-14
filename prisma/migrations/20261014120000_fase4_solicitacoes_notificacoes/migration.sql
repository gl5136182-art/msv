-- CreateEnum
CREATE TYPE "status_solicitacao" AS ENUM ('pendente', 'aceita', 'recusada', 'cancelada', 'concluida');

-- CreateTable
CREATE TABLE "solicitacao" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "ut_destino_id" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "observacao" VARCHAR(500),
    "status" "status_solicitacao" NOT NULL DEFAULT 'pendente',
    "valor_unitario_snapshot" DECIMAL(14,2),
    "motivo_recusa" VARCHAR(500),
    "custo_frete" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "respondida_por_id" TEXT,
    "respondida_em" TIMESTAMP(3),
    "concluida_por_id" TEXT,
    "concluida_em" TIMESTAMP(3),
    "cancelada_por_id" TEXT,
    "cancelada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "mensagem" VARCHAR(300) NOT NULL,
    "link" VARCHAR(255) NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitacao_item_id_status_idx" ON "solicitacao"("item_id", "status");

-- CreateIndex
CREATE INDEX "solicitacao_ut_destino_id_status_idx" ON "solicitacao"("ut_destino_id", "status");

-- CreateIndex
CREATE INDEX "solicitacao_status_concluida_em_idx" ON "solicitacao"("status", "concluida_em");

-- CreateIndex
CREATE INDEX "solicitacao_solicitante_id_idx" ON "solicitacao"("solicitante_id");

-- CreateIndex
CREATE INDEX "notificacao_usuario_id_lida_idx" ON "notificacao"("usuario_id", "lida");

-- AddForeignKey
ALTER TABLE "solicitacao" ADD CONSTRAINT "solicitacao_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao" ADD CONSTRAINT "solicitacao_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao" ADD CONSTRAINT "solicitacao_ut_destino_id_fkey" FOREIGN KEY ("ut_destino_id") REFERENCES "ut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao" ADD CONSTRAINT "solicitacao_respondida_por_id_fkey" FOREIGN KEY ("respondida_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao" ADD CONSTRAINT "solicitacao_concluida_por_id_fkey" FOREIGN KEY ("concluida_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao" ADD CONSTRAINT "solicitacao_cancelada_por_id_fkey" FOREIGN KEY ("cancelada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

