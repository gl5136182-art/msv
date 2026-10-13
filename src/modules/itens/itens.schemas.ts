import { z } from "zod";

import { chaveFotoValida } from "@/lib/chaves-foto";
import { lerDecimalPtBr, lerMoeda } from "@/lib/numeros-ptbr";

// Itens (SPEC §5, §6.1). Importado também por componentes de cliente: só depende do Zod e de `lib/`.

/** Limite de fotos por item (SPEC §6.1). */
export const MAXIMO_FOTOS = 5;

export const ESTADOS = ["novo", "usado_bom", "usado_regular", "com_defeito"] as const;
export type Estado = (typeof ESTADOS)[number];

/** `estado` é a condição do item; o rótulo na interface é "Condição" (SPEC §5). */
export const ROTULO_ESTADO: Record<Estado, string> = {
  novo: "Novo",
  usado_bom: "Usado bom",
  usado_regular: "Usado regular",
  com_defeito: "Com defeito",
};

export const UNIDADES = ["un", "cx", "kg", "m", "l", "par", "jogo"] as const;
export type Unidade = (typeof UNIDADES)[number];

export const ROTULO_UNIDADE: Record<Unidade, string> = {
  un: "Unidade (un)",
  cx: "Caixa (cx)",
  kg: "Quilo (kg)",
  m: "Metro (m)",
  l: "Litro (l)",
  par: "Par",
  jogo: "Jogo",
};

export const STATUS_ITEM = ["disponivel", "esgotado", "arquivado"] as const;
export type StatusItem = (typeof STATUS_ITEM)[number];

export const ORIGENS_DIMENSOES = ["manual", "ia", "ia_ajustada"] as const;
export type OrigemDimensoes = (typeof ORIGENS_DIMENSOES)[number];

// ---------------------------------------------------------------------------------------
// Campos numéricos: o formulário entrega o texto digitado ("R$ 1.234,56", "12,5") e o servidor
// recebe o mesmo texto ou número. As duas pontas passam por estas funções.
// ---------------------------------------------------------------------------------------

const textoOuNumero = z.union([z.number(), z.string()]);

const VALOR_MAXIMO = 100_000_000;
const MEDIDA_MAXIMA = 100_000;
const QUANTIDADE_MAXIMA = 1_000_000;

function arredondar2(n: number): number {
  return Math.round(n * 100) / 100;
}

function moeda(mensagem: string) {
  return textoOuNumero
    .transform((v) => (typeof v === "number" ? v : lerMoeda(v)))
    .pipe(
      z
        .number(mensagem)
        .positive(mensagem)
        .max(VALOR_MAXIMO, "O valor é alto demais. Confira.")
        .transform(arredondar2),
    );
}

function medida(mensagem: string) {
  return textoOuNumero
    .transform((v) => (typeof v === "number" ? v : lerDecimalPtBr(v)))
    .pipe(
      z
        .number(mensagem)
        .positive(mensagem)
        .max(MEDIDA_MAXIMA, "O valor é alto demais. Confira.")
        .transform(arredondar2)
        // Decimal(10,2) guarda 2 casas: um valor que arredonda para 0 não serve.
        .refine((n) => n > 0, mensagem),
    );
}

const quantidade = textoOuNumero
  .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? Number.NaN : Number(v.replace(/\./g, ""))))
  .pipe(
    z
      .number("Informe a quantidade.")
      .int("A quantidade deve ser um número inteiro.")
      .min(1, "A quantidade deve ser pelo menos 1.")
      .max(QUANTIDADE_MAXIMA, "A quantidade é alta demais. Confira."),
  );

function texto(obrigatoria: string, limite: number, nomeDoCampo: string) {
  return z
    .string(obrigatoria)
    .trim()
    .min(1, obrigatoria)
    .max(limite, `${nomeDoCampo} deve ter no máximo ${limite} caracteres.`);
}

export const fotoEnviadaSchema = z.object({
  chave: z.string().refine(chaveFotoValida, "Foto inválida. Envie de novo."),
  chaveThumb: z.string().refine(chaveFotoValida, "Foto inválida. Envie de novo."),
});
export type FotoEnviada = z.infer<typeof fotoEnviadaSchema>;

/** Cadastro e edição de item (SPEC §6.1). A UT vem da sessão, nunca da entrada. */
export const itemSchema = z.object({
  nome: texto("Informe o nome do item.", 150, "O nome"),
  categoriaId: z.string("Selecione a categoria.").min(1, "Selecione a categoria."),
  marca: texto("Informe a marca.", 100, "A marca"),
  modelo: texto("Informe o modelo.", 100, "O modelo"),
  descricao: z
    .string()
    .trim()
    .max(1000, "A descrição deve ter no máximo 1.000 caracteres.")
    .optional()
    .transform((v) => (v ? v : undefined)),
  estado: z.enum(ESTADOS, "Selecione a condição."),
  unidade: z.enum(UNIDADES, "Selecione a unidade."),
  quantidade,
  valorUnitarioReposicao: moeda("Informe o valor de reposição."),
  larguraCm: medida("Informe a largura em cm."),
  alturaCm: medida("Informe a altura em cm."),
  profundidadeCm: medida("Informe a profundidade em cm."),
  pesoKg: medida("Informe o peso em kg."),
  fotos: z
    .array(fotoEnviadaSchema)
    .min(1, "Adicione ao menos uma foto.")
    .max(MAXIMO_FOTOS, `Cada item aceita no máximo ${MAXIMO_FOTOS} fotos.`),
});

/** O que o schema devolve depois de validar (números já convertidos). */
export type ItemEntrada = z.output<typeof itemSchema>;
/** O que o formulário digita (antes de validar). */
export type ItemFormulario = z.input<typeof itemSchema>;

/**
 * Edição dos dados do item (SPEC §6.1, item 7). A quantidade disponível tem ajuste próprio
 * (regras 2 e 3), por isso não entra aqui.
 */
export const editarItemSchema = itemSchema.omit({ quantidade: true }).extend({ id: z.string().min(1) });
export type EditarItemEntrada = z.output<typeof editarItemSchema>;
export type EditarItemFormulario = z.input<typeof editarItemSchema>;

/** Ajuste manual da quantidade disponível (SPEC §3, regra 2): inteiro, nunca negativo. */
export const ajustarQuantidadeSchema = z.object({
  id: z.string().min(1),
  quantidadeDisponivel: textoOuNumero
    .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? Number.NaN : Number(v.replace(/\./g, ""))))
    .pipe(
      z
        .number("Informe a quantidade.")
        .int("A quantidade deve ser um número inteiro.")
        .min(0, "A quantidade não pode ser negativa.")
        .max(QUANTIDADE_MAXIMA, "A quantidade é alta demais. Confira."),
    ),
});
export type AjustarQuantidadeEntrada = z.output<typeof ajustarQuantidadeSchema>;

export const alterarArquivamentoSchema = z.object({ id: z.string().min(1), arquivar: z.boolean() });
export type AlterarArquivamentoEntrada = z.infer<typeof alterarArquivamentoSchema>;

export const prepararUploadFotosSchema = z.object({
  quantidade: z
    .number()
    .int("Quantidade de fotos inválida.")
    .min(1, "Envie pelo menos uma foto.")
    .max(MAXIMO_FOTOS, `Cada item aceita no máximo ${MAXIMO_FOTOS} fotos.`),
});
export type PrepararUploadFotosEntrada = z.infer<typeof prepararUploadFotosSchema>;

/** Chaves e URLs assinadas para o navegador enviar uma foto (principal + miniatura). */
export type UploadFotoDto = {
  chave: string;
  urlUpload: string;
  chaveThumb: string;
  urlUploadThumb: string;
};

/** Item como chega às telas: `Decimal` vira `number` e `Date` vira ISO (CLAUDE.md, DTOs). */
export type ItemDto = {
  id: string;
  utId: string;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  categoria: { id: string; nome: string };
  estado: Estado;
  unidade: Unidade;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  valorUnitarioReposicao: number;
  larguraCm: number;
  alturaCm: number;
  profundidadeCm: number;
  pesoKg: number;
  dimensoesOrigem: OrigemDimensoes;
  status: StatusItem;
  criadoEm: string;
  fotos: Array<{ chave: string; chaveThumb: string; ordem: number }>;
};

/** Item para a tela de edição: inclui as URLs assinadas das miniaturas, por chave da miniatura. */
export type ItemParaEdicaoDto = ItemDto & { previas: Record<string, string> };

/** Linha da lista "Meus itens": o item mais a URL assinada da miniatura da capa. */
export type ItemResumoDto = ItemDto & { urlMiniatura: string | null };
