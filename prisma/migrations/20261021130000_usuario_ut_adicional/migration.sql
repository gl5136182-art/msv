-- UTs adicionais do usuário, além da principal (usuario.ut_id).

-- CreateTable
CREATE TABLE "usuario_ut_adicional" (
    "usuario_id" TEXT NOT NULL,
    "ut_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_ut_adicional_pkey" PRIMARY KEY ("usuario_id","ut_id")
);

-- CreateIndex
CREATE INDEX "usuario_ut_adicional_ut_id_idx" ON "usuario_ut_adicional"("ut_id");

-- AddForeignKey
ALTER TABLE "usuario_ut_adicional" ADD CONSTRAINT "usuario_ut_adicional_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_ut_adicional" ADD CONSTRAINT "usuario_ut_adicional_ut_id_fkey" FOREIGN KEY ("ut_id") REFERENCES "ut"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
