import { z } from "zod";

import { cpfValido, limparCpf } from "@/lib/cpf";
import { PAPEIS, type Papel } from "@/lib/usuario-logado";

// Schemas e DTOs do módulo `usuarios`. Importado também pelos formulários (cliente), por isso
// este arquivo só depende do Zod e de `lib/`.

// --- Login (SPEC §4) ---------------------------------------------------------------------

// Um único campo "E-mail ou CPF" + senha.
export const entrarSchema = z.object({
  identificador: z.string().trim().min(1, "Informe o e-mail ou o CPF."),
  senha: z.string().min(1, "Informe a senha."),
});

export type EntrarEntrada = z.infer<typeof entrarSchema>;

// --- Troca de senha (SPEC §4): mínimo de 8 caracteres e diferente da atual ---------------

export const SENHA_TAMANHO_MINIMO = 8;
export const SENHA_TAMANHO_MAXIMO = 128;

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual."),
    novaSenha: z
      .string()
      .min(SENHA_TAMANHO_MINIMO, `A nova senha deve ter no mínimo ${SENHA_TAMANHO_MINIMO} caracteres.`)
      .max(SENHA_TAMANHO_MAXIMO, `A nova senha deve ter no máximo ${SENHA_TAMANHO_MAXIMO} caracteres.`),
    confirmacao: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((dados) => dados.novaSenha !== dados.senhaAtual, {
    path: ["novaSenha"],
    message: "A nova senha deve ser diferente da atual.",
  })
  .refine((dados) => dados.novaSenha === dados.confirmacao, {
    path: ["confirmacao"],
    message: "As senhas não conferem.",
  });

export type TrocarSenhaEntrada = z.infer<typeof trocarSenhaSchema>;

// --- Administração de usuários (SPEC §6.0) -----------------------------------------------

const papelSchema = z.enum(PAPEIS, { message: "Selecione o papel." });

// Vazio, `null` e ausente viram `null`. Aceitar `null` na entrada deixa o formulário reenviar a
// própria saída validada ao servidor.
const telefoneSchema = z
  .string()
  .trim()
  .max(20, "O telefone deve ter no máximo 20 caracteres.")
  .regex(/^[\d\s()+-]*$/, "Use só números, espaços, parênteses e hífen no telefone.")
  .nullish()
  .transform((valor) => valor || null);

// "" (nenhuma UT selecionada) vira `null`.
const utIdSchema = z
  .string()
  .trim()
  .nullish()
  .transform((valor) => valor || null);

const MENSAGEM_UT_OBRIGATORIA = "Selecione a UT. Só o administrador pode ficar sem UT.";

export const criarUsuarioSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, "Informe o nome.")
      .max(150, "O nome deve ter no máximo 150 caracteres."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Informe o e-mail.")
      .max(255, "O e-mail deve ter no máximo 255 caracteres.")
      .pipe(z.email("Informe um e-mail válido.")),
    // Armazena só os 11 dígitos (LGPD, CLAUDE.md).
    cpf: z
      .string()
      .trim()
      .min(1, "Informe o CPF.")
      .refine((valor) => cpfValido(valor), "CPF inválido.")
      .transform((valor) => limparCpf(valor)),
    telefone: telefoneSchema,
    papel: papelSchema,
    utId: utIdSchema,
  })
  .refine((dados) => dados.papel === "admin" || dados.utId !== null, {
    path: ["utId"],
    message: MENSAGEM_UT_OBRIGATORIA,
  });

export type CriarUsuarioEntrada = z.output<typeof criarUsuarioSchema>;
export type CriarUsuarioFormulario = z.input<typeof criarUsuarioSchema>;

// Edição: papel, UT e telefone (SPEC §6.0). Nome, e-mail e CPF não mudam.
export const editarUsuarioSchema = z
  .object({
    id: z.string().min(1),
    telefone: telefoneSchema,
    papel: papelSchema,
    utId: utIdSchema,
  })
  .refine((dados) => dados.papel === "admin" || dados.utId !== null, {
    path: ["utId"],
    message: MENSAGEM_UT_OBRIGATORIA,
  });

export type EditarUsuarioEntrada = z.output<typeof editarUsuarioSchema>;
export type EditarUsuarioFormulario = z.input<typeof editarUsuarioSchema>;

export const alterarStatusUsuarioSchema = z.object({ id: z.string().min(1), ativo: z.boolean() });
export type AlterarStatusUsuarioEntrada = z.infer<typeof alterarStatusUsuarioSchema>;

export const redefinirSenhaSchema = z.object({ id: z.string().min(1) });
export type RedefinirSenhaEntrada = z.infer<typeof redefinirSenhaSchema>;

export const listarUsuariosSchema = z.object({
  busca: z.string().trim().max(100).optional(),
});
export type ListarUsuariosEntrada = z.infer<typeof listarUsuariosSchema>;

/** Usuário como a tela de admin o vê. O CPF aparece completo, só nesta tela (CLAUDE.md, LGPD). */
export type UsuarioAdminDto = {
  id: string;
  nome: string;
  email: string;
  /** Com máscara: 123.456.789-09. */
  cpf: string;
  telefone: string | null;
  papel: Papel;
  utId: string | null;
  /** "Nome da UT · Cidade/UF", ou `null` para admin sem UT. */
  utRotulo: string | null;
  ativo: boolean;
  deveTrocarSenha: boolean;
  criadoEm: string;
};

/** Resultado de criar usuário ou redefinir a senha: a senha só existe aqui, uma única vez. */
export type CredenciaisGeradasDto = {
  usuario: UsuarioAdminDto;
  senhaGerada: string;
};
