import { z } from "zod";

import { chaveFotoValida } from "@/lib/chaves-foto";
import { lerDecimalPtBr, lerMoeda } from "@/lib/numeros-ptbr";
import { ufValida } from "@/lib/ufs";

// Itens (SPEC §5, §6.1). Importado também por componentes de cliente: só depende do Zod e de `lib/`.

/** Limite de fotos por item (SPEC §6.1). */
export const MAXIMO_FOTOS = 5;

export const ESTADOS = ["novo", "usado_bom", "com_defeito"] as const;
export type Estado = (typeof ESTADOS)[number];

/** `estado` é a condição do item; o rótulo na interface é "Condição" (SPEC §5). */
export const ROTULO_ESTADO: Record<Estado, string> = {
  novo: "Novo",
  usado_bom: "Usado bom",
  com_defeito: "Com defeito",
};

/** Categoria fixa (SPEC §5): "Ativo" é o que se paga por mês; "Material" é comprado, sem mensalidade. */
export const CATEGORIAS_ITEM = ["ativo", "material"] as const;
export type CategoriaItem = (typeof CATEGORIAS_ITEM)[number];

export const ROTULO_CATEGORIA: Record<CategoriaItem, string> = {
  ativo: "Ativo",
  material: "Material",
};

export const SEGMENTOS = ["industrial", "facilities", "logistica", "mineracao", "energia", "oleo_gas"] as const;
export type Segmento = (typeof SEGMENTOS)[number];

export const ROTULO_SEGMENTO: Record<Segmento, string> = {
  industrial: "Industrial",
  facilities: "Facilities",
  logistica: "Logística",
  mineracao: "Mineração",
  energia: "Energia",
  oleo_gas: "Óleo & Gás",
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

/**
 * Campo opcional: vazio ("" ou só espaços) vira `undefined`; preenchido passa pelo `schema`.
 * O formulário entrega o texto digitado, por isso o vazio chega como "".
 */
function opcional<O>(schema: z.ZodType<O, string | number>) {
  return textoOuNumero
    .optional()
    .transform((v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? undefined : v))
    .pipe(schema.optional());
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

/** RM (Registro Manserv): só dígitos, até 20 (SPEC §5). Guardado como texto para manter zeros à esquerda. */
export const TAMANHO_MAXIMO_RM = 20;

const rm = z
  .string("Informe o RM.")
  .trim()
  .min(1, "Informe o RM.")
  .regex(/^\d+$/, "O RM deve ter apenas números.")
  .max(TAMANHO_MAXIMO_RM, `O RM deve ter no máximo ${TAMANHO_MAXIMO_RM} números.`);

const itemBaseSchema = z.object({
  nome: texto("Informe o nome do item.", 150, "O nome"),
  categoria: z.enum(CATEGORIAS_ITEM, "Selecione a categoria."),
  /** R$ por mês. Obrigatório para "Ativo"; descartado para "Material" (ver `refinarItem`). */
  valorDepreciacaoMensal: opcional(moeda("Informe o valor de depreciação.")),
  segmento: z.enum(SEGMENTOS, "Selecione o segmento."),
  rm,
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
  // Medidas e peso de uma unidade: opcionais, cada uma por si (o inventário importado não as traz).
  larguraCm: opcional(medida("Informe a largura em cm.")),
  alturaCm: opcional(medida("Informe a altura em cm.")),
  profundidadeCm: opcional(medida("Informe a profundidade em cm.")),
  pesoKg: opcional(medida("Informe o peso em kg.")),
  // Lote inteiro (todas as unidades juntas), para orçar o frete: tudo ou nada (ver `refinarItem`).
  larguraLoteCm: opcional(medida("Informe a largura do lote em cm.")),
  alturaLoteCm: opcional(medida("Informe a altura do lote em cm.")),
  profundidadeLoteCm: opcional(medida("Informe a profundidade do lote em cm.")),
  pesoLoteKg: opcional(medida("Informe o peso do lote em kg.")),
  fotos: z
    .array(fotoEnviadaSchema)
    .min(1, "Adicione ao menos uma foto.")
    .max(MAXIMO_FOTOS, `Cada item aceita no máximo ${MAXIMO_FOTOS} fotos.`),
});

type CamposRefinados = {
  categoria: CategoriaItem;
  valorDepreciacaoMensal?: number;
  larguraLoteCm?: number;
  alturaLoteCm?: number;
  profundidadeLoteCm?: number;
  pesoLoteKg?: number;
};

const CAMPOS_LOTE = ["larguraLoteCm", "alturaLoteCm", "profundidadeLoteCm", "pesoLoteKg"] as const;
const MENSAGEM_LOTE_INCOMPLETO = "Preencha os 4 campos do lote ou deixe todos em branco.";

/**
 * Regras entre campos (SPEC §6.1):
 *  - "Ativo" exige o valor de depreciação (para "Material" o valor é descartado, ver `normalizarItem`);
 *  - o lote é tudo ou nada: os 4 campos preenchidos ou os 4 em branco.
 */
function refinarItem(dados: CamposRefinados, ctx: z.RefinementCtx): void {
  if (dados.categoria === "ativo" && dados.valorDepreciacaoMensal === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["valorDepreciacaoMensal"],
      message: "Informe o valor de depreciação mensal.",
    });
  }

  const preenchidos = CAMPOS_LOTE.filter((campo) => dados[campo] !== undefined);
  if (preenchidos.length > 0 && preenchidos.length < CAMPOS_LOTE.length) {
    for (const campo of CAMPOS_LOTE) {
      if (dados[campo] === undefined) {
        ctx.addIssue({ code: "custom", path: [campo], message: MENSAGEM_LOTE_INCOMPLETO });
      }
    }
  }
}

/** "Material" não tem depreciação: descarta o valor, mesmo que o formulário o tenha enviado. */
function normalizarItem<T extends CamposRefinados>(dados: T): T {
  return dados.categoria === "material" ? { ...dados, valorDepreciacaoMensal: undefined } : dados;
}

/** Cadastro de item (SPEC §6.1). A UT vem da sessão, nunca da entrada. */
export const itemSchema = itemBaseSchema.superRefine(refinarItem).transform(normalizarItem);

/** O que o schema devolve depois de validar (números já convertidos). */
export type ItemEntrada = z.output<typeof itemSchema>;
/** O que o formulário digita (antes de validar). */
export type ItemFormulario = z.input<typeof itemSchema>;

/**
 * Edição dos dados do item (SPEC §6.1, item 7). A quantidade disponível tem ajuste próprio
 * (regras 2 e 3), por isso não entra aqui.
 */
export const editarItemSchema = itemBaseSchema
  .omit({ quantidade: true })
  .extend({ id: z.string().min(1) })
  .superRefine(refinarItem)
  .transform(normalizarItem);
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

/** Medidas e peso do lote inteiro (SPEC §6.1, item 4.1). */
export type MedidasLoteDto = { larguraCm: number; alturaCm: number; profundidadeCm: number; pesoKg: number };

/** Item como chega às telas: `Decimal` vira `number` e `Date` vira ISO (CLAUDE.md, DTOs). */
export type ItemDto = {
  id: string;
  utId: string;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  categoria: CategoriaItem;
  /** Nulo só nos itens criados antes do campo existir. */
  segmento: Segmento | null;
  /** Nulo só nos itens criados antes do campo existir. */
  rm: string | null;
  estado: Estado;
  unidade: Unidade;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  valorUnitarioReposicao: number;
  /** R$ por mês; só para a categoria "Ativo". */
  valorDepreciacaoMensal: number | null;
  /** Medidas e peso de uma unidade; `null` quando não informados. */
  larguraCm: number | null;
  alturaCm: number | null;
  profundidadeCm: number | null;
  pesoKg: number | null;
  /** Medidas e peso do lote: os 4 preenchidos ou `null`. */
  lote: MedidasLoteDto | null;
  dimensoesOrigem: OrigemDimensoes;
  status: StatusItem;
  criadoEm: string;
  fotos: Array<{ chave: string; chaveThumb: string; ordem: number }>;
};

/** Item para a tela de edição: inclui as URLs assinadas das miniaturas, por chave da miniatura. */
export type ItemParaEdicaoDto = ItemDto & { previas: Record<string, string> };

/**
 * Linha da lista "Meus itens": o item, a URL assinada da miniatura da capa e quantas
 * solicitações pendentes ele tem (SPEC §6.1).
 */
export type ItemResumoDto = ItemDto & { urlMiniatura: string | null; solicitacoesPendentes: number };

// ---------------------------------------------------------------------------------------
// Vitrine (SPEC §6.3)
// ---------------------------------------------------------------------------------------

/** Itens por página da vitrine (SPEC §6.3). */
export const ITENS_POR_PAGINA_VITRINE = 24;

export const ORDENACOES_VITRINE = ["recentes", "maior_valor"] as const;
export type OrdenacaoVitrine = (typeof ORDENACOES_VITRINE)[number];

export const ROTULO_ORDENACAO_VITRINE: Record<OrdenacaoVitrine, string> = {
  recentes: "Mais recentes",
  maior_valor: "Maior valor",
};

const LIMITE_BUSCA_VITRINE = 100;
const LIMITE_PAGINA_VITRINE = 1000;

/**
 * Filtros da vitrine, lidos da URL. É tolerante: parâmetro inválido ou desconhecido é ignorado
 * (volta ao padrão) em vez de gerar erro, porque a URL pode ser digitada ou antiga.
 */
export const filtrosVitrineSchema = z.object({
  busca: z.string().trim().max(LIMITE_BUSCA_VITRINE).optional().catch(undefined),
  categoria: z.enum(CATEGORIAS_ITEM).optional().catch(undefined),
  segmento: z.enum(SEGMENTOS).optional().catch(undefined),
  uf: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine(ufValida)
    .optional()
    .catch(undefined),
  utId: z.string().min(1).optional().catch(undefined),
  estado: z.enum(ESTADOS).optional().catch(undefined),
  ordenar: z.enum(ORDENACOES_VITRINE).catch("recentes"),
  pagina: z.coerce.number().int().min(1).max(LIMITE_PAGINA_VITRINE).catch(1),
});
export type FiltrosVitrine = z.output<typeof filtrosVitrineSchema>;

/** Card da vitrine: dados públicos do item, a UT de origem e a miniatura assinada da capa. */
export type ItemVitrineDto = {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  rm: string | null;
  categoria: CategoriaItem;
  segmento: Segmento | null;
  estado: Estado;
  unidade: Unidade;
  quantidadeDisponivel: number;
  valorUnitarioReposicao: number;
  ut: { id: string; nome: string; cidade: string; uf: string };
  /** Item da UT de quem está olhando: leva a etiqueta "Sua UT" e não pode ser solicitado. */
  daMinhaUt: boolean;
  urlMiniatura: string | null;
};

/** Detalhe do item na vitrine (SPEC §6.3): todos os dados, fotos assinadas e a UT de origem. */
export type ItemDetalheVitrineDto = {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  rm: string | null;
  categoria: CategoriaItem;
  segmento: Segmento | null;
  estado: Estado;
  unidade: Unidade;
  quantidadeDisponivel: number;
  valorUnitarioReposicao: number;
  valorDepreciacaoMensal: number | null;
  larguraCm: number | null;
  alturaCm: number | null;
  profundidadeCm: number | null;
  pesoKg: number | null;
  lote: MedidasLoteDto | null;
  dimensoesOrigem: OrigemDimensoes;
  criadoEm: string;
  ut: { id: string; nome: string; cidade: string; uf: string };
  daMinhaUt: boolean;
  /** Colaborador ou almoxarife de outra UT (SPEC §3, regra 5; o admin não solicita). */
  podeSolicitar: boolean;
  /**
   * UTs do usuário que podem receber o item (ativas e diferentes da UT do item), a principal
   * primeiro. Com mais de uma, o solicitante escolhe o destino.
   */
  utsDestino: Array<{ id: string; rotulo: string }>;
  /** Fotos na ordem do cadastro (a primeira é a capa), com URL assinada da principal e da miniatura. */
  fotos: Array<{ urlPrincipal: string | null; urlMiniatura: string | null }>;
};

export type PaginaVitrineDto = {
  itens: ItemVitrineDto[];
  total: number;
  pagina: number;
  totalPaginas: number;
  porPagina: number;
};
