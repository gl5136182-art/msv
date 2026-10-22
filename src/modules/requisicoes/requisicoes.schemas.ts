import { z } from "zod";

import { UNIDADES, type Estado, type Unidade } from "@/modules/itens/itens.schemas";

// Requisições de compra com recomendação de reuso (SPEC §6.6). Importado também por componentes
// de cliente: só depende do Zod e de schemas.

export const STATUS_REQUISICAO = ["rascunho", "aberta", "atendida_reuso", "parcial", "enviada_compra", "cancelada"] as const;
export type StatusRequisicao = (typeof STATUS_REQUISICAO)[number];

export const ROTULO_STATUS_REQUISICAO: Record<StatusRequisicao, string> = {
  rascunho: "Rascunho",
  aberta: "Aberta",
  atendida_reuso: "Atendida por reuso",
  parcial: "Parcial",
  enviada_compra: "Enviada para compra",
  cancelada: "Cancelada",
};

/** Como o solicitante encerra uma requisição aberta (o rascunho só pode ser cancelado). */
export const ENCERRAMENTOS = ["atendida_reuso", "parcial", "enviada_compra", "cancelada"] as const;
export type Encerramento = (typeof ENCERRAMENTOS)[number];

export const ROTULO_ENCERRAMENTO: Record<Encerramento, string> = {
  atendida_reuso: "Atendida por reuso",
  parcial: "Parcial (reuso + compra)",
  enviada_compra: "Enviada para compra",
  cancelada: "Cancelar requisição",
};

/** `123` → `REQ-000123`. */
export function codigoRequisicao(numero: number): string {
  return `REQ-${String(numero).padStart(6, "0")}`;
}

export const LIMITE_DESCRICAO_LINHA = 300;
export const LIMITE_OBSERVACAO_LINHA = 300;
export const LIMITE_JUSTIFICATIVA = 500;
export const MAXIMO_LINHAS = 30;
const QUANTIDADE_MAXIMA = 1_000_000;

const textoOpcional = (limite: number, mensagem: string) =>
  z
    .string()
    .trim()
    .max(limite, mensagem)
    .optional()
    .transform((v) => (v ? v : undefined));

export const linhaRequisicaoSchema = z.object({
  descricao: z
    .string("Descreva o item.")
    .trim()
    .min(3, "Descreva o item.")
    .max(LIMITE_DESCRICAO_LINHA, `A descrição deve ter no máximo ${LIMITE_DESCRICAO_LINHA} caracteres.`),
  quantidade: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? Number.NaN : Number(v.replace(/\./g, ""))))
    .pipe(
      z
        .number("Informe a quantidade.")
        .int("A quantidade deve ser um número inteiro.")
        .min(1, "A quantidade deve ser pelo menos 1.")
        .max(QUANTIDADE_MAXIMA, "A quantidade é alta demais. Confira."),
    ),
  unidade: z.enum(UNIDADES, "Selecione a unidade."),
  observacao: textoOpcional(LIMITE_OBSERVACAO_LINHA, `A observação deve ter no máximo ${LIMITE_OBSERVACAO_LINHA} caracteres.`),
});

/** Criar (ou editar o rascunho). `abrir` abre já e dispara a análise da vitrine. */
export const requisicaoSchema = z.object({
  utId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  justificativa: textoOpcional(LIMITE_JUSTIFICATIVA, `A justificativa deve ter no máximo ${LIMITE_JUSTIFICATIVA} caracteres.`),
  linhas: z
    .array(linhaRequisicaoSchema)
    .min(1, "Inclua pelo menos um item.")
    .max(MAXIMO_LINHAS, `No máximo ${MAXIMO_LINHAS} itens por requisição.`),
  abrir: z.boolean(),
});
export type RequisicaoFormulario = z.input<typeof requisicaoSchema>;
export type RequisicaoEntrada = z.output<typeof requisicaoSchema>;

export const idRequisicaoSchema = z.object({ id: z.string().min(1, "Requisição inválida.") });
export type IdRequisicaoEntrada = z.infer<typeof idRequisicaoSchema>;

export const editarRequisicaoSchema = requisicaoSchema.extend(idRequisicaoSchema.shape);
export type EditarRequisicaoEntrada = z.output<typeof editarRequisicaoSchema>;

export const encerrarRequisicaoSchema = idRequisicaoSchema.extend({
  status: z.enum(ENCERRAMENTOS, "Escolha como encerrar."),
});
export type EncerrarRequisicaoEntrada = z.infer<typeof encerrarRequisicaoSchema>;

// ---------------------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------------------

export type UtResumoDto = { id: string; nome: string; cidade: string; uf: string };

export type AcoesRequisicao = { editar: boolean; analisar: boolean; encerrar: boolean };

export type RequisicaoResumoDto = {
  id: string;
  codigo: string;
  status: StatusRequisicao;
  ut: UtResumoDto;
  solicitante: { nome: string };
  criadoEm: string;
  analisadaEm: string | null;
  totalLinhas: number;
  /** Linhas com alguma recomendação de reuso. */
  linhasComReuso: number;
  /** Linhas cobertas por inteiro pelo reuso. */
  linhasCobertas: number;
};

export type RecomendacaoDto = {
  id: string;
  quantidadeSugerida: number;
  aderencia: "exata" | "similar";
  justificativa: string;
  item: {
    id: string;
    nome: string;
    marca: string;
    modelo: string;
    rm: string | null;
    estado: Estado;
    unidade: Unidade;
    /** Disponível agora (pode ter mudado desde a análise). */
    quantidadeDisponivel: number;
    /** O item ainda aparece na vitrine (disponível e de UT ativa). */
    naVitrine: boolean;
    ut: UtResumoDto;
    urlMiniatura: string | null;
  };
};

export type LinhaRequisicaoDto = {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: Unidade;
  observacao: string | null;
  recomendacoes: RecomendacaoDto[];
  /** Soma das quantidades sugeridas. */
  quantidadeReuso: number;
  /** O que falta comprar. */
  quantidadeComprar: number;
};

export type RequisicaoDto = Omit<RequisicaoResumoDto, "linhasComReuso" | "linhasCobertas"> & {
  justificativa: string | null;
  analiseComIa: boolean;
  linhas: LinhaRequisicaoDto[];
  acoes: AcoesRequisicao;
  ehSolicitante: boolean;
};

/** Dados para o formulário: UTs do usuário que podem requisitar e, na edição, o rascunho. */
export type FormularioRequisicaoDto = {
  uts: Array<{ id: string; rotulo: string }>;
  rascunho: {
    id: string;
    codigo: string;
    utId: string;
    justificativa: string;
    linhas: Array<{ descricao: string; quantidade: number; unidade: Unidade; observacao: string }>;
  } | null;
};
