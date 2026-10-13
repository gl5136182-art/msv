import { ErroNegocio } from "@/lib/erro-negocio";
import { normalizar } from "@/lib/normalizar";
import { exigirPapel } from "@/lib/permissoes";
import type { UsuarioLogado } from "@/lib/usuario-logado";

import * as repository from "./categorias.repository";
import type { CategoriaRegistro } from "./categorias.repository";
import type {
  AlterarStatusCategoriaEntrada,
  CategoriaDto,
  CategoriaEntrada,
  RenomearCategoriaEntrada,
} from "./categorias.schemas";

// Categorias (SPEC §6.0). Só o admin cria, renomeia e ativa/desativa. Qualquer usuário logado
// lê as ativas (selects e filtros). Itens de categoria desativada continuam com ela.

const MENSAGEM_NOME_DUPLICADO = "Já existe uma categoria com este nome.";

function paraDto(categoria: CategoriaRegistro): CategoriaDto {
  return { id: categoria.id, nome: categoria.nome, ativo: categoria.ativo };
}

/** Todas as categorias (ativas e inativas), para a tela de admin. */
export async function listarCategorias(usuario: UsuarioLogado): Promise<CategoriaDto[]> {
  exigirPapel(usuario, "admin");
  return (await repository.listar()).map(paraDto);
}

/** Categorias ativas, para selects e filtros. Qualquer usuário logado e ativo. */
export async function listarCategoriasAtivas(usuario: UsuarioLogado): Promise<CategoriaDto[]> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");
  return (await repository.listarAtivas()).map(paraDto);
}

export async function criarCategoria(usuario: UsuarioLogado, entrada: CategoriaEntrada): Promise<CategoriaDto> {
  exigirPapel(usuario, "admin");
  await exigirNomeLivre(entrada.nome, null);

  try {
    return paraDto(await repository.criar(entrada.nome));
  } catch (erro) {
    throw traduzirErroDeUnicidade(erro);
  }
}

export async function renomearCategoria(
  usuario: UsuarioLogado,
  entrada: RenomearCategoriaEntrada,
): Promise<CategoriaDto> {
  exigirPapel(usuario, "admin");
  await buscarOuFalhar(entrada.id);
  await exigirNomeLivre(entrada.nome, entrada.id);

  try {
    return paraDto(await repository.renomear(entrada.id, entrada.nome));
  } catch (erro) {
    throw traduzirErroDeUnicidade(erro);
  }
}

export async function alterarStatusCategoria(
  usuario: UsuarioLogado,
  entrada: AlterarStatusCategoriaEntrada,
): Promise<CategoriaDto> {
  exigirPapel(usuario, "admin");
  await buscarOuFalhar(entrada.id);
  return paraDto(await repository.definirAtivo(entrada.id, entrada.ativo));
}

async function buscarOuFalhar(id: string): Promise<CategoriaRegistro> {
  const categoria = await repository.buscarPorId(id);
  if (!categoria) throw new ErroNegocio("CATEGORIA_NAO_ENCONTRADA", "Categoria não encontrada.");
  return categoria;
}

// O nome é único sem considerar caixa nem acento ("EPI" e "epi", "Elétrica" e "Eletrica").
// A lista é curta, então a comparação é feita aqui, com `normalizar`.
async function exigirNomeLivre(nome: string, idAtual: string | null): Promise<void> {
  const alvo = normalizar(nome);
  const existentes = await repository.listar();
  const conflito = existentes.find((c) => c.id !== idAtual && normalizar(c.nome) === alvo);
  if (conflito) throw new ErroNegocio("NOME_DUPLICADO", MENSAGEM_NOME_DUPLICADO);
}

// Última barreira: o índice único do banco (P2002) para duas requisições simultâneas.
function traduzirErroDeUnicidade(erro: unknown): unknown {
  const codigo = typeof erro === "object" && erro !== null && "code" in erro ? erro.code : undefined;
  return codigo === "P2002" ? new ErroNegocio("NOME_DUPLICADO", MENSAGEM_NOME_DUPLICADO) : erro;
}
