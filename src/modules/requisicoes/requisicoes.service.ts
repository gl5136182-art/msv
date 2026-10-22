import { db } from "@/infra/db";
import { iaDisponivel } from "@/infra/llm";
import { obterUrls } from "@/infra/storage";
import { ErroNegocio } from "@/lib/erro-negocio";
import { exigirPapel } from "@/lib/permissoes";
import { rotuloUt } from "@/lib/rotulo-ut";
import { temPapel, utsDoUsuario, vinculadoAUt, type UsuarioLogado } from "@/lib/usuario-logado";
import {
  alocarQuantidades,
  gerarConsultas,
  julgarCandidatos,
  ranquear,
  type Candidato,
  type LinhaParaAnalise,
} from "@/modules/ia/recomendar-reuso";
import { buscarCandidatosReuso } from "@/modules/itens/itens.service";
import { listarUtsAtivasPorIds } from "@/modules/uts/uts.service";

import * as repository from "./requisicoes.repository";
import type { DadosRecomendacao, RequisicaoDetalhe, RequisicaoParaLista } from "./requisicoes.repository";
import { codigoRequisicao } from "./requisicoes.schemas";
import type {
  AcoesRequisicao,
  EditarRequisicaoEntrada,
  EncerrarRequisicaoEntrada,
  FormularioRequisicaoDto,
  IdRequisicaoEntrada,
  RequisicaoDto,
  RequisicaoEntrada,
  RequisicaoResumoDto,
  StatusRequisicao,
} from "./requisicoes.schemas";

// Requisições de compra com recomendação de reuso (SPEC §6.6). Colaborador e almoxarife abrem
// requisições para uma das suas UTs; ao abrir, a vitrine é analisada e cada linha recebe os
// itens de outras UTs que podem atendê-la. Só exibe: pedir o item continua sendo a Solicitação.

/** Análises por usuário por dia (custo da IA). */
export const LIMITE_ANALISES_POR_DIA = 30;
/** Intervalo mínimo entre duas análises da mesma requisição. */
export const INTERVALO_REANALISE_MS = 60_000;

function acoesPermitidas(usuario: UsuarioLogado, r: { solicitanteId: string; status: StatusRequisicao }): AcoesRequisicao {
  const dono = r.solicitanteId === usuario.id && temPapel(usuario.papel, "colaborador", "almoxarife");
  return {
    editar: dono && r.status === "rascunho",
    analisar: dono && r.status === "aberta",
    encerrar: dono && (r.status === "rascunho" || r.status === "aberta"),
  };
}

/** Quem vê: o solicitante, o admin (todas) e o almoxarife das UTs da requisição (exceto rascunho). */
function podeVer(usuario: UsuarioLogado, r: { solicitanteId: string; utId: string; status: StatusRequisicao }): boolean {
  if (r.solicitanteId === usuario.id) return true;
  if (temPapel(usuario.papel, "admin")) return true;
  return r.status !== "rascunho" && temPapel(usuario.papel, "almoxarife") && vinculadoAUt(usuario, r.utId);
}

/** A UT da requisição: a escolhida ou, sem escolha, a única do usuário. */
function resolverUt(usuario: UsuarioLogado, utId: string | undefined): string {
  const uts = utsDoUsuario(usuario);
  if (uts.length === 0) {
    throw new ErroNegocio("SEM_UT", "Seu usuário não está vinculado a uma UT. Fale com o administrador.");
  }
  const escolhida = utId ?? (uts.length === 1 ? uts[0] : undefined);
  if (!escolhida) throw new ErroNegocio("UT_OBRIGATORIA", "Selecione a UT da requisição.");
  if (!uts.includes(escolhida)) throw new ErroNegocio("UT_INVALIDA", "Você não está vinculado a esta UT.");
  return escolhida;
}

async function carregarDoSolicitante(usuario: UsuarioLogado, id: string): Promise<RequisicaoDetalhe> {
  const atual = await repository.buscarPorId(id);
  if (!atual || !podeVer(usuario, atual)) {
    throw new ErroNegocio("REQUISICAO_NAO_ENCONTRADA", "Requisição não encontrada.");
  }
  if (atual.solicitanteId !== usuario.id) {
    throw new ErroNegocio("SEM_PERMISSAO", "Somente quem abriu a requisição pode alterá-la.");
  }
  return atual;
}

function dadosDaEntrada(entrada: RequisicaoEntrada) {
  return {
    justificativa: entrada.justificativa ?? null,
    linhas: entrada.linhas.map((l) => ({
      descricao: l.descricao,
      quantidade: l.quantidade,
      unidade: l.unidade,
      observacao: l.observacao ?? null,
    })),
  };
}

/** Cria a requisição como rascunho ou já aberta (neste caso, analisa a vitrine em seguida). */
export async function criar(
  usuario: UsuarioLogado,
  entrada: RequisicaoEntrada,
  agora: Date = new Date(),
): Promise<{ id: string }> {
  exigirPapel(usuario, "colaborador", "almoxarife");
  const utId = resolverUt(usuario, entrada.utId);
  if (entrada.abrir) await exigirCotaDeAnalise(usuario, agora);

  const criada = await repository.criar({
    solicitanteId: usuario.id,
    utId,
    status: "rascunho",
    ...dadosDaEntrada(entrada),
  });
  if (entrada.abrir) await analisarRequisicao(usuario, criada.id, agora);
  return criada;
}

/** Edita o rascunho (cabeçalho e linhas). Com `abrir`, abre e analisa. */
export async function editar(
  usuario: UsuarioLogado,
  entrada: EditarRequisicaoEntrada,
  agora: Date = new Date(),
): Promise<{ id: string }> {
  exigirPapel(usuario, "colaborador", "almoxarife");
  const atual = await carregarDoSolicitante(usuario, entrada.id);
  if (atual.status !== "rascunho") {
    throw new ErroNegocio("REQUISICAO_NAO_EDITAVEL", "Só é possível editar uma requisição em rascunho.");
  }
  const utId = resolverUt(usuario, entrada.utId);
  if (entrada.abrir) await exigirCotaDeAnalise(usuario, agora);

  const trocou = await db.$transaction((tx) =>
    repository.substituirRascunho(atual.id, { utId, status: "rascunho", ...dadosDaEntrada(entrada) }, tx),
  );
  if (!trocou) {
    throw new ErroNegocio("REQUISICAO_MUDOU", "Esta requisição foi alterada. Atualize a página e tente de novo.");
  }
  if (entrada.abrir) await analisarRequisicao(usuario, atual.id, agora);
  return { id: atual.id };
}

/** Abre um rascunho (analisa a vitrine) ou reanalisa uma requisição aberta. */
export async function analisar(
  usuario: UsuarioLogado,
  entrada: IdRequisicaoEntrada,
  agora: Date = new Date(),
): Promise<{ id: string }> {
  exigirPapel(usuario, "colaborador", "almoxarife");
  const atual = await carregarDoSolicitante(usuario, entrada.id);
  if (atual.status !== "rascunho" && atual.status !== "aberta") {
    throw new ErroNegocio("REQUISICAO_ENCERRADA", "Esta requisição já foi encerrada.");
  }
  if (atual.analisadaEm && agora.getTime() - atual.analisadaEm.getTime() < INTERVALO_REANALISE_MS) {
    throw new ErroNegocio("ANALISE_RECENTE", "A vitrine acabou de ser analisada. Aguarde um minuto para analisar de novo.");
  }
  await exigirCotaDeAnalise(usuario, agora);
  await analisarRequisicao(usuario, atual.id, agora);
  return { id: atual.id };
}

/** Encerra: aberta → atendida por reuso, parcial, enviada para compra ou cancelada; rascunho → cancelada. */
export async function encerrar(usuario: UsuarioLogado, entrada: EncerrarRequisicaoEntrada): Promise<{ id: string }> {
  exigirPapel(usuario, "colaborador", "almoxarife");
  const atual = await carregarDoSolicitante(usuario, entrada.id);
  const de: StatusRequisicao[] = entrada.status === "cancelada" ? ["rascunho", "aberta"] : ["aberta"];
  if (!de.includes(atual.status)) {
    throw new ErroNegocio(
      "REQUISICAO_NAO_ENCERRAVEL",
      atual.status === "rascunho"
        ? "Abra a requisição antes de encerrá-la, ou cancele o rascunho."
        : "Esta requisição já foi encerrada.",
    );
  }
  const mudou = await repository.mudarStatusSe(atual.id, de, entrada.status);
  if (!mudou) {
    throw new ErroNegocio("REQUISICAO_MUDOU", "Esta requisição foi alterada. Atualize a página e tente de novo.");
  }
  return { id: atual.id };
}

/** Início do dia em São Paulo (UTC−3, sem horário de verão desde 2019). */
function inicioDoDia(agora: Date): Date {
  const local = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3));
}

async function exigirCotaDeAnalise(usuario: UsuarioLogado, agora: Date): Promise<void> {
  if (!iaDisponivel()) return;
  const feitas = await repository.contarAnalisadasDesde(usuario.id, inicioDoDia(agora));
  if (feitas >= LIMITE_ANALISES_POR_DIA) {
    throw new ErroNegocio(
      "LIMITE_ANALISES",
      `Você atingiu o limite de ${LIMITE_ANALISES_POR_DIA} análises por dia. Tente de novo amanhã.`,
    );
  }
}

/**
 * Analisa a vitrine para todas as linhas (pipeline em `modules/ia/recomendar-reuso`) e grava as
 * recomendações. Itens das UTs do solicitante (e da UT da requisição) nunca entram.
 */
async function analisarRequisicao(usuario: UsuarioLogado, id: string, agora: Date): Promise<void> {
  const requisicao = await repository.buscarPorId(id);
  if (!requisicao) throw new ErroNegocio("REQUISICAO_NAO_ENCONTRADA", "Requisição não encontrada.");

  const linhas: LinhaParaAnalise[] = requisicao.linhas.map((l) => ({
    descricao: l.descricao,
    quantidade: l.quantidade,
    unidade: l.unidade,
    observacao: l.observacao,
  }));
  const utsExcluidas = [...new Set([...utsDoUsuario(usuario), requisicao.utId])];

  const { consultas, comIa: consultasComIa } = await gerarConsultas(linhas);
  const encontrados = await Promise.all(consultas.map((c) => buscarCandidatosReuso(c, utsExcluidas)));
  const preSelecionados: Candidato[][] = encontrados.map((lista, i) =>
    ranquear(lista, consultas[i], linhas[i]).map((r) => r.candidato),
  );
  const { escolhas, comIa: julgamentoComIa } = await julgarCandidatos(linhas, preSelecionados, consultas);

  // Saldo compartilhado entre as linhas: o mesmo item não é prometido duas vezes.
  const saldo = new Map(preSelecionados.flat().map((c) => [c.id, c.quantidadeDisponivel]));
  // Primeiro o que cobre a quantidade; depois as alternativas (o mesmo item em outras UTs), com
  // quantidade sugerida 0, para quem requisita escolher a UT mais próxima.
  const recomendacoes: DadosRecomendacao[] = requisicao.linhas.flatMap((linha, i) => {
    const { alocacoes, alternativas } = alocarQuantidades(linha.quantidade, escolhas[i], saldo);
    return [...alocacoes, ...alternativas.map((e) => ({ ...e, quantidade: 0 }))].map((a, ordem) => ({
      linhaId: linha.id,
      itemId: a.itemId,
      quantidadeSugerida: a.quantidade,
      aderencia: a.aderencia,
      justificativa: a.justificativa,
      ordem,
    }));
  });

  await db.$transaction((tx) =>
    repository.gravarAnalise(
      id,
      {
        recomendacoes,
        analisadaEm: agora,
        analiseComIa: consultasComIa && julgamentoComIa,
        status: requisicao.status === "rascunho" ? "aberta" : requisicao.status,
      },
      tx,
    ),
  );
}

// ---------------------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------------------

const VALIDADE_URLS_SEG = 60 * 60;

function resumo(r: RequisicaoParaLista): RequisicaoResumoDto {
  const comReuso = r.linhas.map((l) => l.recomendacoes.reduce((soma, rec) => soma + rec.quantidadeSugerida, 0));
  return {
    id: r.id,
    codigo: codigoRequisicao(r.numero),
    status: r.status,
    ut: r.ut,
    solicitante: { nome: r.solicitante.name },
    criadoEm: r.criadoEm.toISOString(),
    analisadaEm: r.analisadaEm?.toISOString() ?? null,
    totalLinhas: r.linhas.length,
    linhasComReuso: comReuso.filter((q) => q > 0).length,
    linhasCobertas: r.linhas.filter((l, i) => comReuso[i] >= l.quantidade).length,
  };
}

/** Lista da página Requisições: as minhas, as das minhas UTs (almoxarife) ou todas (admin). */
export async function listarRequisicoes(usuario: UsuarioLogado): Promise<RequisicaoResumoDto[]> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");
  const registros = await repository.listar({
    solicitanteId: usuario.id,
    utIds: temPapel(usuario.papel, "almoxarife") ? utsDoUsuario(usuario) : [],
    todas: temPapel(usuario.papel, "admin"),
  });
  return registros.filter((r) => podeVer(usuario, r)).map(resumo);
}

/** Detalhe com as recomendações e a situação atual de cada item recomendado. */
export async function obterRequisicao(usuario: UsuarioLogado, id: string): Promise<RequisicaoDto> {
  exigirPapel(usuario, "colaborador", "almoxarife", "admin");
  const r = await repository.buscarPorId(id);
  if (!r || !podeVer(usuario, r)) {
    throw new ErroNegocio("REQUISICAO_NAO_ENCONTRADA", "Requisição não encontrada.");
  }

  const capas = r.linhas
    .flatMap((l) => l.recomendacoes.map((rec) => rec.item.fotos[0]?.chaveThumb))
    .filter((c): c is string => Boolean(c));
  const urls = capas.length > 0 ? await obterUrls(capas, VALIDADE_URLS_SEG) : {};

  return {
    id: r.id,
    codigo: codigoRequisicao(r.numero),
    status: r.status,
    ut: r.ut,
    solicitante: { nome: r.solicitante.name },
    justificativa: r.justificativa,
    criadoEm: r.criadoEm.toISOString(),
    analisadaEm: r.analisadaEm?.toISOString() ?? null,
    analiseComIa: r.analiseComIa,
    totalLinhas: r.linhas.length,
    ehSolicitante: r.solicitanteId === usuario.id,
    acoes: acoesPermitidas(usuario, r),
    linhas: r.linhas.map((linha) => {
      const quantidadeReuso = linha.recomendacoes.reduce((soma, rec) => soma + rec.quantidadeSugerida, 0);
      return {
        id: linha.id,
        descricao: linha.descricao,
        quantidade: linha.quantidade,
        unidade: linha.unidade,
        observacao: linha.observacao,
        quantidadeReuso,
        quantidadeComprar: Math.max(0, linha.quantidade - quantidadeReuso),
        recomendacoes: linha.recomendacoes.map((rec) => {
          const capa = rec.item.fotos[0]?.chaveThumb;
          const { ativo, ...ut } = rec.item.ut;
          return {
            id: rec.id,
            quantidadeSugerida: rec.quantidadeSugerida,
            aderencia: rec.aderencia === "exata" ? "exata" : "similar",
            justificativa: rec.justificativa,
            item: {
              id: rec.item.id,
              nome: rec.item.nome,
              marca: rec.item.marca,
              modelo: rec.item.modelo,
              rm: rec.item.rm,
              estado: rec.item.estado,
              unidade: rec.item.unidade,
              quantidadeDisponivel: rec.item.quantidadeDisponivel,
              naVitrine: ativo && rec.item.status === "disponivel" && rec.item.quantidadeDisponivel > 0,
              ut,
              urlMiniatura: (capa && urls[capa]) || null,
            },
          };
        }),
      };
    }),
  };
}

/** UTs para o formulário e, na edição, o rascunho. */
export async function obterFormulario(usuario: UsuarioLogado, id?: string): Promise<FormularioRequisicaoDto> {
  exigirPapel(usuario, "colaborador", "almoxarife");
  const uts = (await listarUtsAtivasPorIds(utsDoUsuario(usuario))).map((ut) => ({ id: ut.id, rotulo: rotuloUt(ut) }));
  if (!id) return { uts, rascunho: null };

  const atual = await carregarDoSolicitante(usuario, id);
  if (atual.status !== "rascunho") {
    throw new ErroNegocio("REQUISICAO_NAO_EDITAVEL", "Só é possível editar uma requisição em rascunho.");
  }
  return {
    uts,
    rascunho: {
      id: atual.id,
      codigo: codigoRequisicao(atual.numero),
      utId: atual.utId,
      justificativa: atual.justificativa ?? "",
      linhas: atual.linhas.map((l) => ({
        descricao: l.descricao,
        quantidade: l.quantidade,
        unidade: l.unidade,
        observacao: l.observacao ?? "",
      })),
    },
  };
}
