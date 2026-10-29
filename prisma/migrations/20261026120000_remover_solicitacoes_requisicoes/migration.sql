/*
  Warnings:

  - You are about to drop the `requisicao` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requisicao_linha` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `requisicao_recomendacao` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `solicitacao` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "requisicao_recomendacao";

-- DropTable
DROP TABLE "requisicao_linha";

-- DropTable
DROP TABLE "requisicao";

-- DropTable
DROP TABLE "solicitacao";

-- DropEnum
DROP TYPE "status_requisicao";

-- DropEnum
DROP TYPE "status_solicitacao";
