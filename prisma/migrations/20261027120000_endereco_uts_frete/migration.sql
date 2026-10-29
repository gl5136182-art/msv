-- Endereço opcional das UTs. O CEP é validado pelo service no momento da cotação de frete.
ALTER TABLE "ut"
  ADD COLUMN "cep" VARCHAR(8),
  ADD COLUMN "logradouro" VARCHAR(150),
  ADD COLUMN "numero" VARCHAR(20),
  ADD COLUMN "complemento" VARCHAR(100),
  ADD COLUMN "bairro" VARCHAR(100);
