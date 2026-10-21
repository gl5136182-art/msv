import { z } from "zod";

import { lerMoeda } from "@/lib/numeros-ptbr";

// Solicitações (SPEC §3, regras 5 a 13; §6.4). Importado também por componentes de cliente:
// só depende do Zod.

export const STATUS_SOLICITACAO = ["pendente", "aceita", "recusada", "cancelada", "concluida"] as const;
export type StatusSolicitacao = (typeof STATUS_SOLICITACAO)[number];

export const ROTULO_STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = {
  pendente: "Pendente",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

/** Motivos das recusas automáticas (SPEC §3, regras 4 e 8). */
export const MOTIVO_ITEM_ESGOTADO = "Item esgotado";
export const MOTIVO_ITEM_RETIRADO = "Item retirado da vitrine";

export const LIMITE_OBSERVACAO = 500;

const QUANTIDADE_MAXIMA = 1_000_000;

const textoOuNumero = z.union([z.number(), z.string()]);

/**
 * Solicitar (§6.4): item, UT de destino, quantidade (a disponibilidade é conferida no service) e
 * observação. Sem UT de destino, vale a única UT do solicitante; com mais de uma, ela é obrigatória.
 */
export const solicitarSchema = z.object({
  itemId: z.string().min(1, "Item inválido."),
  utDestinoId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  quantidade: textoOuNumero
    .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? Number.NaN : Number(v.replace(/\./g, ""))))
    .pipe(
      z
        .number("Informe a quantidade.")
        .int("A quantidade deve ser um número inteiro.")
        .min(1, "A quantidade deve ser pelo menos 1.")
        .max(QUANTIDADE_MAXIMA, "A quantidade é alta demais. Confira."),
    ),
  observacao: z
    .string()
    .trim()
    .max(LIMITE_OBSERVACAO, `A observação deve ter no máximo ${LIMITE_OBSERVACAO} caracteres.`)
    .optional()
    .transform((v) => (v ? v : undefined)),
});
export type SolicitarFormulario = z.input<typeof solicitarSchema>;
export type SolicitarEntrada = z.output<typeof solicitarSchema>;

/** Ações que só precisam saber qual solicitação (aceitar). */
export const idSolicitacaoSchema = z.object({ id: z.string().min(1, "Solicitação inválida.") });
export type IdSolicitacaoEntrada = z.infer<typeof idSolicitacaoSchema>;

export const LIMITE_MOTIVO_RECUSA = 500;

/** Recusar exige o motivo (SPEC §3, regra 7). */
export const recusarSchema = idSolicitacaoSchema.extend({
  motivo: z
    .string("Informe o motivo da recusa.")
    .trim()
    .min(1, "Informe o motivo da recusa.")
    .max(LIMITE_MOTIVO_RECUSA, `O motivo deve ter no máximo ${LIMITE_MOTIVO_RECUSA} caracteres.`),
});
export type RecusarEntrada = z.infer<typeof recusarSchema>;

const FRETE_MAXIMO = 100_000_000;

/**
 * Concluir (SPEC §3, regra 10): custo do frete opcional, em R$, padrão 0. Aceita o texto do
 * campo mascarado ("R$ 1.234,56") ou um número; vazio vale 0.
 */
export const concluirSchema = idSolicitacaoSchema.extend({
  custoFrete: textoOuNumero
    .optional()
    .transform((v) => {
      if (v === undefined) return 0;
      if (typeof v === "number") return v;
      return v.trim() === "" ? 0 : lerMoeda(v);
    })
    .pipe(
      z
        .number("Informe um valor de frete válido.")
        .min(0, "O frete não pode ser negativo.")
        .max(FRETE_MAXIMO, "O valor do frete é alto demais. Confira.")
        .transform((n) => Math.round(n * 100) / 100),
    ),
});
export type ConcluirFormulario = z.input<typeof concluirSchema>;
export type ConcluirEntrada = z.output<typeof concluirSchema>;

/** Solicitação como a interface a recebe (sem `Decimal` nem `Date`). */
export type SolicitacaoDto = {
  id: string;
  itemId: string;
  solicitanteId: string;
  utDestinoId: string;
  quantidade: number;
  observacao: string | null;
  status: StatusSolicitacao;
  criadoEm: string;
};

// ---------------------------------------------------------------------------------------
// Listagem (página Solicitações, SPEC §6.4)
// ---------------------------------------------------------------------------------------

/** Abas: "Minhas" (enviadas pela minha UT) e "Recebidas" (pedidos aos itens da minha UT). */
export const ABAS_SOLICITACOES = ["minhas", "recebidas"] as const;
export type AbaSolicitacoes = (typeof ABAS_SOLICITACOES)[number];

export const listarSolicitacoesSchema = z.object({ aba: z.enum(ABAS_SOLICITACOES) });
export type ListarSolicitacoesEntrada = z.infer<typeof listarSolicitacoesSchema>;

export type UtResumoDto = { id: string; nome: string; cidade: string; uf: string };

export type ContatoDto = { nome: string; email: string; telefone: string | null };

export type SolicitacaoListaDto = {
  id: string;
  status: StatusSolicitacao;
  quantidade: number;
  observacao: string | null;
  motivoRecusa: string | null;
  criadoEm: string;
  respondidaEm: string | null;
  concluidaEm: string | null;
  canceladaEm: string | null;
  /** Valor de reposição unitário: o gravado ao aceitar (snapshot) ou, antes disso, o atual do item. */
  valorUnitario: number;
  /** Só nas concluídas. */
  custoFrete: number | null;
  item: {
    id: string;
    nome: string;
    marca: string;
    modelo: string;
    rm: string | null;
    unidade: string;
    urlMiniatura: string | null;
  };
  utOrigem: UtResumoDto;
  utDestino: UtResumoDto;
  solicitante: { nome: string };
  /** Contatos para combinar o transporte: só enquanto a solicitação está `aceita` (regra 12). */
  contatos: { origem: ContatoDto | null; destino: ContatoDto } | null;
  acoes: { aceitar: boolean; recusar: boolean; cancelar: boolean; concluir: boolean };
};
