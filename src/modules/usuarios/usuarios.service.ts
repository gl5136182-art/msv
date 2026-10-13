import {
  encerrarSessaoDaRequisicao,
  entrarComEmailESenha,
  gerarHashDeSenha,
  gerarIdDeAuth,
  trocarSenhaDaSessao,
} from "@/infra/auth";
import { db } from "@/infra/db";
import { cpfValido, formatarCpf, limparCpf, pareceCpf } from "@/lib/cpf";
import { ErroNegocio } from "@/lib/erro-negocio";
import { normalizar } from "@/lib/normalizar";
import { exigirPapel } from "@/lib/permissoes";
import { rotuloUt } from "@/lib/rotulo-ut";
import { gerarSenha } from "@/lib/senha";
import type { UsuarioLogado } from "@/lib/usuario-logado";
import { exigirUtAtiva } from "@/modules/uts/uts.service";

import * as repository from "./usuarios.repository";
import type { UsuarioRegistro } from "./usuarios.repository";
import type {
  AlterarStatusUsuarioEntrada,
  CredenciaisGeradasDto,
  CriarUsuarioEntrada,
  EditarUsuarioEntrada,
  EntrarEntrada,
  ListarUsuariosEntrada,
  TrocarSenhaEntrada,
  UsuarioAdminDto,
} from "./usuarios.schemas";

export type ContextoDeRequisicao = {
  /** Cabeçalhos da requisição: o IP alimenta o rate limit do login. */
  cabecalhos: Headers;
};

// =========================================================================================
// Login, logout e troca da própria senha (SPEC §4)
// =========================================================================================

// Mensagem única para qualquer falha de login (SPEC §4): não revela se o CPF/e-mail existe,
// se o usuário está inativo nem se foi a senha que errou.
const MENSAGEM_LOGIN_INVALIDO = "E-mail/CPF ou senha inválidos.";

// E-mail que nunca existe. Quando o CPF não é encontrado (ou o usuário está inativo), o login
// segue com ele: o Better Auth faz o mesmo trabalho de um login real, e o tempo de resposta
// não revela se o CPF está cadastrado.
const EMAIL_INEXISTENTE = "usuario-inexistente@msv.invalid";

/**
 * Login por "E-mail ou CPF" + senha (SPEC §4). Em caso de sucesso o cookie de sessão fica
 * gravado; qualquer falha lança `ErroNegocio` com a mensagem genérica.
 */
export async function entrar(entrada: EntrarEntrada, contexto: ContextoDeRequisicao): Promise<void> {
  const email = await resolverEmailDoLogin(entrada.identificador);

  const resultado = await entrarComEmailESenha({
    email,
    senha: entrada.senha,
    cabecalhos: contexto.cabecalhos,
  });

  if (resultado === "limite") {
    throw new ErroNegocio(
      "LIMITE_DE_TENTATIVAS",
      "Muitas tentativas de login. Aguarde um minuto e tente de novo.",
    );
  }
  if (resultado === "invalido") {
    throw new ErroNegocio("CREDENCIAIS_INVALIDAS", MENSAGEM_LOGIN_INVALIDO);
  }
}

/** Encerra a sessão atual (logout). */
export async function sair(contexto: ContextoDeRequisicao): Promise<void> {
  await encerrarSessaoDaRequisicao(contexto.cabecalhos);
}

/**
 * Troca a senha do próprio usuário (SPEC §4): confere a senha atual, grava a nova, encerra as
 * outras sessões e tira a obrigatoriedade de troca. Serve à troca obrigatória e à voluntária.
 * O mínimo de 8 caracteres e "diferente da atual" são validados no schema da action.
 */
export async function trocarSenha(
  usuario: UsuarioLogado,
  entrada: TrocarSenhaEntrada,
  contexto: ContextoDeRequisicao,
): Promise<void> {
  if (!usuario.ativo) {
    throw new ErroNegocio("USUARIO_INATIVO", "Seu usuário está inativo. Fale com o administrador.");
  }

  const resultado = await trocarSenhaDaSessao({
    senhaAtual: entrada.senhaAtual,
    novaSenha: entrada.novaSenha,
    cabecalhos: contexto.cabecalhos,
  });
  if (resultado === "senha_atual_invalida") {
    throw new ErroNegocio("SENHA_ATUAL_INVALIDA", "A senha atual está incorreta.");
  }

  // Só depois de a senha ter mudado: se isto falhar, o usuário apenas troca de novo.
  if (usuario.deveTrocarSenha) {
    await repository.marcarSenhaComoTrocada(usuario.id);
  }
}

/**
 * Se o valor, sem pontuação, tem 11 dígitos é CPF: busca o e-mail do usuário. Senão é o
 * próprio e-mail. Usuário inativo ou não encontrado vira `EMAIL_INEXISTENTE`.
 */
async function resolverEmailDoLogin(identificador: string): Promise<string> {
  let credencial: repository.CredencialDeLogin | null;

  if (pareceCpf(identificador)) {
    const cpf = limparCpf(identificador);
    credencial = cpfValido(cpf) ? await repository.buscarLoginPorCpf(cpf) : null;
  } else {
    credencial = await repository.buscarLoginPorEmail(identificador.trim().toLowerCase());
  }

  return credencial?.ativo ? credencial.email : EMAIL_INEXISTENTE;
}

// =========================================================================================
// Administração de usuários (SPEC §6.0): só o admin
// =========================================================================================

const MENSAGEM_EMAIL_DUPLICADO = "Já existe um usuário com este e-mail.";
const MENSAGEM_CPF_DUPLICADO = "Já existe um usuário com este CPF.";

export function paraDto(registro: UsuarioRegistro): UsuarioAdminDto {
  return {
    id: registro.id,
    nome: registro.name,
    email: registro.email,
    cpf: formatarCpf(registro.cpf),
    telefone: registro.telefone,
    papel: registro.papel,
    utId: registro.utId,
    utRotulo: registro.ut ? rotuloUt(registro.ut) : null,
    ativo: registro.ativo,
    deveTrocarSenha: registro.deveTrocarSenha,
    criadoEm: registro.createdAt.toISOString(),
  };
}

/** Todos os usuários (ativos e inativos), com busca sem acento por nome, e-mail, CPF e UT. */
export async function listarUsuarios(
  usuario: UsuarioLogado,
  filtro: ListarUsuariosEntrada = {},
): Promise<UsuarioAdminDto[]> {
  exigirPapel(usuario, "admin");

  const termo = normalizar(filtro.busca ?? "");
  const termoCpf = limparCpf(filtro.busca ?? "");
  const registros = await repository.listar();

  return registros
    .filter((r) => {
      if (!termo) return true;
      const texto = normalizar(`${r.name} ${r.email} ${r.ut ? rotuloUt(r.ut) : ""}`);
      return texto.includes(termo) || (termoCpf.length >= 3 && r.cpf.includes(termoCpf));
    })
    .map(paraDto);
}

/**
 * Cria o usuário com uma senha gerada pelo sistema (10 caracteres). A senha volta uma única
 * vez, para o admin repassar; só o hash é gravado. O usuário nasce com troca obrigatória.
 */
export async function criarUsuario(
  usuario: UsuarioLogado,
  entrada: CriarUsuarioEntrada,
): Promise<CredenciaisGeradasDto> {
  exigirPapel(usuario, "admin");

  if (entrada.utId) await exigirUtAtiva(entrada.utId);
  if (await repository.existeComEmail(entrada.email)) {
    throw new ErroNegocio("EMAIL_DUPLICADO", MENSAGEM_EMAIL_DUPLICADO);
  }
  if (await repository.existeComCpf(entrada.cpf)) {
    throw new ErroNegocio("CPF_DUPLICADO", MENSAGEM_CPF_DUPLICADO);
  }

  const senhaGerada = gerarSenha();
  const hash = await gerarHashDeSenha(senhaGerada);
  const id = gerarIdDeAuth();

  try {
    await db.$transaction(async (tx) => {
      await repository.criar(
        {
          id,
          name: entrada.nome,
          email: entrada.email,
          cpf: entrada.cpf,
          telefone: entrada.telefone,
          papel: entrada.papel,
          utId: entrada.utId,
        },
        tx,
      );
      await repository.criarContaDeSenha({ id: gerarIdDeAuth(), usuarioId: id, hash }, tx);
    });
  } catch (erro) {
    throw traduzirErroDeUnicidade(erro);
  }

  return { usuario: paraDto(await buscarOuFalhar(id)), senhaGerada };
}

/** Papel, UT e telefone (SPEC §6.0). Nome, e-mail e CPF não mudam. */
export async function editarUsuario(
  usuario: UsuarioLogado,
  entrada: EditarUsuarioEntrada,
): Promise<UsuarioAdminDto> {
  exigirPapel(usuario, "admin");

  const atual = await buscarOuFalhar(entrada.id);
  // Só valida a UT quando ela muda: o usuário pode continuar numa UT que depois foi desativada.
  if (entrada.utId && entrada.utId !== atual.utId) await exigirUtAtiva(entrada.utId);

  await repository.atualizarPerfil(entrada.id, {
    papel: entrada.papel,
    utId: entrada.utId,
    telefone: entrada.telefone,
  });
  return paraDto(await buscarOuFalhar(entrada.id));
}

/**
 * Gera uma nova senha: marca a troca obrigatória e revoga as sessões do usuário (SPEC §6.0).
 * Devolve a senha uma única vez.
 */
export async function redefinirSenha(usuario: UsuarioLogado, id: string): Promise<CredenciaisGeradasDto> {
  exigirPapel(usuario, "admin");
  await buscarOuFalhar(id);

  const senhaGerada = gerarSenha();
  const hash = await gerarHashDeSenha(senhaGerada);

  await db.$transaction(async (tx) => {
    await repository.trocarHashDaSenha(id, hash, tx);
    await repository.definirDeveTrocarSenha(id, true, tx);
    await repository.revogarSessoes(id, tx);
  });

  return { usuario: paraDto(await buscarOuFalhar(id)), senhaGerada };
}

/**
 * Ativa ou desativa. Desativar revoga as sessões na hora (SPEC §4). O admin não desativa a
 * si mesmo.
 */
export async function alterarStatusUsuario(
  usuario: UsuarioLogado,
  entrada: AlterarStatusUsuarioEntrada,
): Promise<UsuarioAdminDto> {
  exigirPapel(usuario, "admin");

  if (!entrada.ativo && entrada.id === usuario.id) {
    throw new ErroNegocio("AUTO_DESATIVACAO", "Você não pode desativar o seu próprio usuário.");
  }
  await buscarOuFalhar(entrada.id);

  await db.$transaction(async (tx) => {
    await repository.definirAtivo(entrada.id, entrada.ativo, tx);
    if (!entrada.ativo) await repository.revogarSessoes(entrada.id, tx);
  });

  return paraDto(await buscarOuFalhar(entrada.id));
}

async function buscarOuFalhar(id: string): Promise<UsuarioRegistro> {
  const registro = await repository.buscarPorId(id);
  if (!registro) throw new ErroNegocio("USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.");
  return registro;
}

// Duas requisições simultâneas passam pelas checagens de duplicidade; o índice único do banco
// (P2002) é a barreira final. O Prisma informa o campo em `meta.target`.
function traduzirErroDeUnicidade(erro: unknown): unknown {
  if (typeof erro !== "object" || erro === null || !("code" in erro) || erro.code !== "P2002") return erro;

  const meta = "meta" in erro && typeof erro.meta === "object" && erro.meta !== null ? erro.meta : null;
  const alvo = meta && "target" in meta ? String(meta.target) : "";

  if (alvo.includes("cpf")) return new ErroNegocio("CPF_DUPLICADO", MENSAGEM_CPF_DUPLICADO);
  return new ErroNegocio("EMAIL_DUPLICADO", MENSAGEM_EMAIL_DUPLICADO);
}
