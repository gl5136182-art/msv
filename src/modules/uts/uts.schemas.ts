import { z } from "zod";

import { ufValida } from "@/lib/ufs";

// UT (SPEC §6.0): código, nome, cidade e UF são todos obrigatórios. Importado também pelo
// formulário (cliente), por isso este arquivo só depende do Zod e de `lib/`.
export const utSchema = z.object({
  // Número da UT na Manserv, com pontos (ex.: 06.00.0171.256). Gravado como digitado, só aparado.
  codigo: z
    .string()
    .trim()
    .min(1, "Informe o código da UT.")
    .max(20, "O código deve ter no máximo 20 caracteres.")
    .regex(/^[A-Za-z0-9.-]+$/, "Use só letras, números, ponto e hífen no código."),
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome da UT.")
    .max(150, "O nome deve ter no máximo 150 caracteres."),
  cidade: z
    .string()
    .trim()
    .min(1, "Informe a cidade.")
    .max(100, "A cidade deve ter no máximo 100 caracteres."),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((valor) => ufValida(valor), "Selecione a UF."),
});

/** O que o schema devolve depois de validar (`uf` já é uma sigla válida). */
export type UtEntrada = z.output<typeof utSchema>;
/** O que o formulário digita (antes de validar). */
export type UtFormulario = z.input<typeof utSchema>;

export const editarUtSchema = utSchema.extend({ id: z.string().min(1) });
export type EditarUtEntrada = z.infer<typeof editarUtSchema>;

export const alterarStatusUtSchema = z.object({ id: z.string().min(1), ativo: z.boolean() });
export type AlterarStatusUtEntrada = z.infer<typeof alterarStatusUtSchema>;

export const listarUtsSchema = z.object({ busca: z.string().trim().max(100).optional() });
export type ListarUtsEntrada = z.infer<typeof listarUtsSchema>;

/** UT como chega às telas: `Date` vira string ISO (CLAUDE.md, DTOs). */
export type UtDto = {
  id: string;
  codigo: string;
  nome: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  /** "Nome da UT · Cidade/UF". */
  rotulo: string;
  criadoEm: string;
};
