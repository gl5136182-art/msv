import { ErroNegocio } from "@/lib/erro-negocio";
import { normalizar } from "@/lib/normalizar";
import { exigirPapel } from "@/lib/permissoes";
import { rotuloUt } from "@/lib/rotulo-ut";
import type { UsuarioLogado } from "@/lib/usuario-logado";

import * as repository from "./uts.repository";
import type { UtRegistro } from "./uts.repository";
import type {
  AlterarStatusUtEntrada,
  EditarUtEntrada,
  ListarUtsEntrada,
  UtDto,
  UtEntrada,
} from "./uts.schemas";

// Administração de UTs (SPEC §6.0). Só o admin cria, edita e ativa/desativa. Não há exclusão.
// O efeito de desativar sobre solicitações pendentes (regra 13) entra na Fase 4.

const MENSAGEM_CODIGO_DUPLICADO = "Já existe uma UT com este código.";

export function paraDto(ut: UtRegistro): UtDto {
  return {
    id: ut.id,
    codigo: ut.codigo,
    nome: ut.nome,
    cidade: ut.cidade,
    uf: ut.uf,
    ativo: ut.ativo,
    rotulo: rotuloUt(ut),
    criadoEm: ut.criadoEm.toISOString(),
  };
}

/** Todas as UTs (ativas e inativas) para a tela de admin, com busca sem acento. */
export async function listarUts(usuario: UsuarioLogado, filtro: ListarUtsEntrada = {}): Promise<UtDto[]> {
  exigirPapel(usuario, "admin");

  const termo = normalizar(filtro.busca ?? "");
  const uts = await repository.listar();

  return uts
    .filter((ut) => !termo || normalizar(`${ut.codigo} ${ut.nome} ${ut.cidade} ${ut.uf}`).includes(termo))
    .map(paraDto);
}

/** UTs ativas, para selects (formulário de usuário, filtros). Qualquer usuário logado e ativo. */
export async function listarUtsAtivas(usuario: UsuarioLogado): Promise<UtDto[]> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");
  return (await repository.listarAtivas()).map(paraDto);
}

export async function obterUt(usuario: UsuarioLogado, id: string): Promise<UtDto> {
  exigirPapel(usuario, "admin");
  return paraDto(await buscarOuFalhar(id));
}

export async function criarUt(usuario: UsuarioLogado, entrada: UtEntrada): Promise<UtDto> {
  exigirPapel(usuario, "admin");

  if (await repository.buscarPorCodigo(entrada.codigo)) {
    throw new ErroNegocio("CODIGO_DUPLICADO", MENSAGEM_CODIGO_DUPLICADO);
  }

  try {
    return paraDto(await repository.criar(dadosDaUt(entrada)));
  } catch (erro) {
    throw traduzirErroDeUnicidade(erro);
  }
}

export async function editarUt(usuario: UsuarioLogado, entrada: EditarUtEntrada): Promise<UtDto> {
  exigirPapel(usuario, "admin");
  await buscarOuFalhar(entrada.id);

  const comMesmoCodigo = await repository.buscarPorCodigo(entrada.codigo);
  if (comMesmoCodigo && comMesmoCodigo.id !== entrada.id) {
    throw new ErroNegocio("CODIGO_DUPLICADO", MENSAGEM_CODIGO_DUPLICADO);
  }

  try {
    return paraDto(await repository.atualizar(entrada.id, dadosDaUt(entrada)));
  } catch (erro) {
    throw traduzirErroDeUnicidade(erro);
  }
}

export async function alterarStatusUt(usuario: UsuarioLogado, entrada: AlterarStatusUtEntrada): Promise<UtDto> {
  exigirPapel(usuario, "admin");
  await buscarOuFalhar(entrada.id);
  return paraDto(await repository.definirAtivo(entrada.id, entrada.ativo));
}

/** "Nome · Cidade/UF" da UT, ou `null` quando o usuário não tem UT (admin) ou ela não existe. */
export async function obterRotuloDaUt(utId: string | null): Promise<string | null> {
  if (!utId) return null;
  const ut = await repository.buscarPorId(utId);
  return ut ? rotuloUt(ut) : null;
}

/**
 * Para outros módulos (ex.: usuários): confere que a UT existe e está ativa. Os selects só
 * mostram UTs ativas, mas a regra precisa valer também no servidor (SPEC §7).
 */
export async function exigirUtAtiva(utId: string): Promise<UtDto> {
  const ut = await repository.buscarPorId(utId);
  if (!ut) throw new ErroNegocio("UT_NAO_ENCONTRADA", "UT não encontrada.");
  if (!ut.ativo) throw new ErroNegocio("UT_INATIVA", "Esta UT está inativa. Escolha uma UT ativa.");
  return paraDto(ut);
}

async function buscarOuFalhar(id: string): Promise<UtRegistro> {
  const ut = await repository.buscarPorId(id);
  if (!ut) throw new ErroNegocio("UT_NAO_ENCONTRADA", "UT não encontrada.");
  return ut;
}

function dadosDaUt(entrada: UtEntrada) {
  return { codigo: entrada.codigo, nome: entrada.nome, cidade: entrada.cidade, uf: entrada.uf };
}

// Duas requisições simultâneas com o mesmo código passam pela checagem acima; o índice único
// do banco (P2002) é a barreira final.
function traduzirErroDeUnicidade(erro: unknown): unknown {
  const codigo = typeof erro === "object" && erro !== null && "code" in erro ? erro.code : undefined;
  return codigo === "P2002" ? new ErroNegocio("CODIGO_DUPLICADO", MENSAGEM_CODIGO_DUPLICADO) : erro;
}
