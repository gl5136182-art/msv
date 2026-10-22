import { z } from "zod";

import { completarJson } from "@/infra/llm";
import { normalizar } from "@/lib/normalizar";

// Recomendação de reuso para requisições de compra (SPEC §6.6). Pipeline híbrido:
//   1. `gerarConsultas`: a IA transforma cada linha em consultas curtas (sinônimos, variações);
//   2. a busca no banco é do service de itens (só itens reais, disponíveis, de outras UTs);
//   3. `julgarCandidatos`: a IA escolhe, entre os candidatos encontrados, os que servem;
//   4. `alocarQuantidades`: o código distribui as quantidades, nunca acima do disponível. Os itens
//      escolhidos que não entram na conta seguem como alternativas: o mesmo item pode estar em
//      várias UTs, e quem requisita escolhe a mais próxima.
// A IA nunca inventa item nem quantidade: ids fora da lista de candidatos são descartados.
// Sem IA (sem chave ou falha), cada etapa tem uma versão por palavras-chave.

/** Uma linha da requisição, como a análise a recebe. */
export type LinhaParaAnalise = {
  descricao: string;
  quantidade: number;
  unidade: string;
  observacao: string | null;
};

/** Item da vitrine que pode atender uma linha. */
export type Candidato = {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  descricao: string | null;
  estado: string;
  unidade: string;
  quantidadeDisponivel: number;
  utNome: string;
  buscaNormalizada: string;
};

export type Aderencia = "exata" | "similar";

export type Escolha = { itemId: string; aderencia: Aderencia; justificativa: string };

export type Alocacao = Escolha & { quantidade: number };

/** Uma consulta é uma lista de palavras normalizadas que precisam aparecer todas no item. */
export type Consulta = string[];

const MAXIMO_CONSULTAS_POR_LINHA = 6;
const MAXIMO_PALAVRAS_POR_CONSULTA = 4;
export const MAXIMO_CANDIDATOS_POR_LINHA = 20;
const TAMANHO_JUSTIFICATIVA = 300;

const PALAVRAS_VAZIAS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos",
  "para", "pra", "com", "sem", "por", "um", "uma", "uns", "umas", "tipo", "modelo", "marca",
  "unidade", "unidades", "peca", "pecas", "novo", "nova", "novos", "novas",
]);

/** Plural simples para singular ("tomadas" → "tomada"), para a busca por "contém" achar os dois. */
function singular(palavra: string): string {
  return palavra.length > 4 && palavra.endsWith("s") && !palavra.endsWith("ss") ? palavra.slice(0, -1) : palavra;
}

/** Palavras úteis de um texto: normalizadas, sem palavras vazias nem números soltos de 1 dígito. */
export function palavrasChave(texto: string): string[] {
  const palavras = normalizar(texto)
    .split(/[\s,;:()/]+/)
    .map((p) => p.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((p) => p.length >= 2 && !PALAVRAS_VAZIAS.has(p))
    .map(singular);
  return [...new Set(palavras)];
}

/** Consulta sem IA: cada palavra-chave da descrição sozinha (o ranking decide o que serve). */
export function consultasPorPalavras(linha: LinhaParaAnalise): Consulta[] {
  return palavrasChave(linha.descricao).map((p) => [p]);
}

function paraConsulta(texto: string): Consulta {
  return palavrasChave(texto).slice(0, MAXIMO_PALAVRAS_POR_CONSULTA);
}

// ---------------------------------------------------------------------------------------
// 1. Consultas
// ---------------------------------------------------------------------------------------

const SISTEMA_CONSULTAS = `Você ajuda a encontrar materiais e equipamentos em um catálogo interno de reaproveitamento entre unidades de uma empresa de serviços (facilities, manutenção industrial, logística).
O catálogo é pesquisado por "contém palavra": cada consulta é uma frase curta e TODAS as palavras dela precisam aparecer no cadastro do item.
Para cada linha da requisição, gere de 3 a 6 consultas curtas (1 a 3 palavras cada), em português do Brasil, minúsculas e sem acentos:
- a primeira é o nome principal do item no singular (ex.: "tomada", "notebook", "cadeira");
- depois, sinônimos e nomes usados no almoxarifado (ex.: "computador portatil" → "notebook", "laptop");
- depois, o nome com a especificação mais importante (ex.: "tomada 10a", "parafuso m10");
- não use quantidades, unidades de medida da compra nem palavras genéricas ("material", "item", "novo").
Responda só com JSON no formato {"linhas":[{"indice":0,"consultas":["..."]}]}, uma entrada por linha, na mesma ordem.`;

const respostaConsultasSchema = z.object({
  linhas: z.array(z.object({ indice: z.number().int(), consultas: z.array(z.string()) })),
});

/**
 * Consultas de busca para cada linha. Com IA, as sugeridas por ela somadas às palavras da própria
 * descrição (garantia contra uma resposta ruim); sem IA, só as palavras. `comIa` diz se a IA respondeu.
 */
export async function gerarConsultas(linhas: LinhaParaAnalise[]): Promise<{ consultas: Consulta[][]; comIa: boolean }> {
  const porPalavras = linhas.map(consultasPorPalavras);

  const resposta = await completarJson({
    sistema: SISTEMA_CONSULTAS,
    usuario: JSON.stringify({
      linhas: linhas.map((l, indice) => ({ indice, descricao: l.descricao, observacao: l.observacao ?? undefined })),
    }),
  });
  const lida = respostaConsultasSchema.safeParse(resposta);
  if (!lida.success) return { consultas: porPalavras, comIa: false };

  const consultas = linhas.map((_, indice) => {
    const daIa = (lida.data.linhas.find((l) => l.indice === indice)?.consultas ?? [])
      .slice(0, MAXIMO_CONSULTAS_POR_LINHA)
      .map(paraConsulta);
    return unicas([...daIa, ...porPalavras[indice]]);
  });
  return { consultas, comIa: true };
}

function unicas(consultas: Consulta[]): Consulta[] {
  const vistas = new Set<string>();
  return consultas.filter((c) => {
    const chave = c.join(" ");
    if (c.length === 0 || vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

// ---------------------------------------------------------------------------------------
// Ranking por palavras (pré-seleção dos candidatos e fallback sem IA)
// ---------------------------------------------------------------------------------------

/**
 * Pontua cada candidato pelas consultas que casam por inteiro (peso maior) e pelas palavras da
 * descrição da linha que aparecem no item. Devolve os melhores, do maior para o menor.
 */
export function ranquear(
  candidatos: Candidato[],
  consultas: Consulta[],
  linha: LinhaParaAnalise,
  limite = MAXIMO_CANDIDATOS_POR_LINHA,
): Array<{ candidato: Candidato; pontos: number; fracaoPalavras: number }> {
  const palavras = palavrasChave(linha.descricao);
  return candidatos
    .map((candidato) => {
      const texto = candidato.buscaNormalizada;
      const consultasCasadas = consultas.filter((c) => c.every((p) => texto.includes(p))).length;
      const palavrasCasadas = palavras.filter((p) => texto.includes(p)).length;
      const fracaoPalavras = palavras.length === 0 ? 0 : palavrasCasadas / palavras.length;
      return { candidato, pontos: consultasCasadas * 2 + palavrasCasadas, fracaoPalavras };
    })
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || b.candidato.quantidadeDisponivel - a.candidato.quantidadeDisponivel)
    .slice(0, limite);
}

/**
 * Escolha sem IA: candidatos que têm pelo menos metade das palavras da descrição, sempre como
 * "similar" (sem a IA não dá para afirmar que é o mesmo item).
 */
export function escolherPorPalavras(
  candidatos: Candidato[],
  consultas: Consulta[],
  linha: LinhaParaAnalise,
): Escolha[] {
  const palavras = palavrasChave(linha.descricao).length;
  return ranquear(candidatos, consultas, linha)
    .filter((r) => r.fracaoPalavras >= 0.5)
    .map((r) => ({
      itemId: r.candidato.id,
      aderencia: "similar",
      justificativa: `Busca por palavras (sem IA): ${Math.round(r.fracaoPalavras * palavras)} de ${palavras} palavras da descrição aparecem no item.`,
    }));
}

// ---------------------------------------------------------------------------------------
// 3. Julgamento
// ---------------------------------------------------------------------------------------

const SISTEMA_JULGAMENTO = `Você analisa uma requisição de compra e decide quais itens já existentes em outras unidades da empresa podem ser reaproveitados no lugar da compra.
Para cada linha da requisição você recebe candidatos encontrados no catálogo (com código "ref", nome, marca, modelo, descrição, condição, unidade e quantidade disponível).
Regras:
- escolha apenas candidatos que realmente atendem o que a linha pede; na dúvida, deixe de fora;
- "exata": é o mesmo tipo de item e as especificações pedidas (tensão, corrente, medida, capacidade, configuração) são compatíveis ou não foram informadas;
- "similar": serve como substituto, mas com alguma diferença relevante (outra especificação, outro modelo, condição usada); diga a diferença na justificativa;
- itens com condição "com_defeito" só se a linha aceitar explicitamente;
- o mesmo item pode aparecer em várias unidades: inclua TODOS os candidatos que atendem, mesmo que um só já cubra a quantidade (quem requisita escolhe a unidade mais próxima);
- ordene do mais recomendado para o menos recomendado; não se preocupe com quantidades, elas são calculadas depois;
- use somente as refs fornecidas; justificativa curta (até 160 caracteres), em português.
Responda só com JSON no formato {"linhas":[{"indice":0,"itens":[{"ref":"c1","aderencia":"exata","justificativa":"..."}]}]}. Linha sem item adequado: "itens": [].`;

const respostaJulgamentoSchema = z.object({
  linhas: z.array(
    z.object({
      indice: z.number().int(),
      itens: z.array(
        z.object({
          ref: z.string(),
          aderencia: z.enum(["exata", "similar"]),
          justificativa: z.string().default(""),
        }),
      ),
    }),
  ),
});

/**
 * Escolhe, para cada linha, os candidatos que servem. Os candidatos chegam pré-selecionados
 * (`ranquear`). Sem IA (ou resposta inválida), usa `escolherPorPalavras`.
 */
export async function julgarCandidatos(
  linhas: LinhaParaAnalise[],
  candidatos: Candidato[][],
  consultas: Consulta[][],
): Promise<{ escolhas: Escolha[][]; comIa: boolean }> {
  const semIa = () => ({
    escolhas: linhas.map((linha, i) => escolherPorPalavras(candidatos[i], consultas[i], linha)),
    comIa: false,
  });
  if (candidatos.every((lista) => lista.length === 0)) return { escolhas: linhas.map(() => []), comIa: true };

  // Refs curtas por linha ("c1", "c2"...): menos texto para a IA e nenhum id real para copiar errado.
  const entrada = linhas.map((linha, indice) => ({
    indice,
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    unidade: linha.unidade,
    observacao: linha.observacao ?? undefined,
    candidatos: candidatos[indice].map((c, j) => ({
      ref: `c${j + 1}`,
      nome: c.nome,
      marca: c.marca,
      modelo: c.modelo,
      descricao: c.descricao ? c.descricao.slice(0, 240) : undefined,
      condicao: c.estado,
      unidade: c.unidade,
      disponivel: c.quantidadeDisponivel,
    })),
  }));

  const resposta = await completarJson({ sistema: SISTEMA_JULGAMENTO, usuario: JSON.stringify({ linhas: entrada }) });
  const lida = respostaJulgamentoSchema.safeParse(resposta);
  if (!lida.success) return semIa();

  const escolhas = linhas.map((_, indice) => {
    const daLinha = candidatos[indice];
    const vistos = new Set<string>();
    const itens = lida.data.linhas.find((l) => l.indice === indice)?.itens ?? [];
    const validas: Escolha[] = [];
    for (const item of itens) {
      const candidato = daLinha[Number(item.ref.replace(/\D/g, "")) - 1];
      if (!candidato || vistos.has(candidato.id)) continue;
      vistos.add(candidato.id);
      validas.push({
        itemId: candidato.id,
        aderencia: item.aderencia,
        justificativa: item.justificativa.trim().slice(0, TAMANHO_JUSTIFICATIVA) || "Recomendado pela IA.",
      });
    }
    return validas;
  });
  return { escolhas, comIa: true };
}

// ---------------------------------------------------------------------------------------
// 4. Alocação
// ---------------------------------------------------------------------------------------

/**
 * Distribui a quantidade pedida pelos itens escolhidos: exatas antes de similares, na ordem de
 * preferência, cada um até o que ainda tem disponível. `saldo` é compartilhado entre as linhas
 * (o mesmo item não é prometido duas vezes) e é atualizado aqui. Os escolhidos que não entram na
 * conta (a quantidade já fechou, ou o saldo foi para outra linha) voltam em `alternativas`.
 */
export function alocarQuantidades(
  quantidadePedida: number,
  escolhas: Escolha[],
  saldo: Map<string, number>,
): { alocacoes: Alocacao[]; alternativas: Escolha[]; faltante: number } {
  const ordenadas = [
    ...escolhas.filter((e) => e.aderencia === "exata"),
    ...escolhas.filter((e) => e.aderencia !== "exata"),
  ];
  let restante = quantidadePedida;
  const alocacoes: Alocacao[] = [];
  const alternativas: Escolha[] = [];
  for (const escolha of ordenadas) {
    const disponivel = saldo.get(escolha.itemId) ?? 0;
    const quantidade = Math.min(restante, disponivel);
    if (quantidade <= 0) {
      alternativas.push(escolha);
      continue;
    }
    saldo.set(escolha.itemId, disponivel - quantidade);
    restante -= quantidade;
    alocacoes.push({ ...escolha, quantidade });
  }
  return { alocacoes, alternativas, faltante: restante };
}
