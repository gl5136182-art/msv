-- Dimensões e peso de uma unidade passam a ser opcionais: a carga do inventário do almoxarifado
-- (planilha) não traz essas medidas. Os itens existentes mantêm os valores que já têm.

-- AlterTable
ALTER TABLE "item"
  ALTER COLUMN "largura_cm" DROP NOT NULL,
  ALTER COLUMN "altura_cm" DROP NOT NULL,
  ALTER COLUMN "profundidade_cm" DROP NOT NULL,
  ALTER COLUMN "peso_kg" DROP NOT NULL;
