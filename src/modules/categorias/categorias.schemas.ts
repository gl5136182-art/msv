import { z } from "zod";

// Categorias (SPEC §6.0): lista simples, com criar, renomear e ativar/desativar.
// Importado também pelo formulário (cliente), por isso só depende do Zod.
export const categoriaSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome da categoria.")
    .max(100, "O nome deve ter no máximo 100 caracteres."),
});

export type CategoriaEntrada = z.infer<typeof categoriaSchema>;

export const renomearCategoriaSchema = categoriaSchema.extend({ id: z.string().min(1) });
export type RenomearCategoriaEntrada = z.infer<typeof renomearCategoriaSchema>;

export const alterarStatusCategoriaSchema = z.object({ id: z.string().min(1), ativo: z.boolean() });
export type AlterarStatusCategoriaEntrada = z.infer<typeof alterarStatusCategoriaSchema>;

export type CategoriaDto = {
  id: string;
  nome: string;
  ativo: boolean;
};
