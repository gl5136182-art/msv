import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Selo } from "@/components/ui/selo";
import { TagIa } from "@/components/ui/tag-ia";
import { formatarDataHora, formatarQuantidade } from "@/lib/formatacao";
import { rotuloUt } from "@/lib/rotulo-ut";
import { ROTULO_ESTADO } from "@/modules/itens/itens.schemas";
import { obterRequisicao } from "@/modules/requisicoes/requisicoes.actions";
import {
  ROTULO_STATUS_REQUISICAO,
  type LinhaRequisicaoDto,
  type RecomendacaoDto,
} from "@/modules/requisicoes/requisicoes.schemas";

import { VARIANTE_STATUS } from "../status";
import { AcoesRequisicao } from "./acoes-requisicao";

export const metadata: Metadata = { title: "Requisição" };

// "Buscar de novo na vitrine" roda a análise com a IA nesta página (duas chamadas ao provedor).
export const maxDuration = 120;

type RecomendacaoProps = { rec: RecomendacaoDto; comIa: boolean; ufRequisicao: string };

function Recomendacao({ rec, comIa, ufRequisicao }: RecomendacaoProps) {
  const { item } = rec;
  return (
    <li className="flex gap-3 rounded-md border border-border p-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-md bg-cinza">
        {item.urlMiniatura ? (
          // URL assinada: o otimizador do Next não cacheia, então <img> simples (SPEC §6.3).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.urlMiniatura} alt="" className="size-full object-cover" />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{item.nome}</p>
          <Selo variante={rec.aderencia === "exata" ? "ok" : "contorno"}>
            {rec.aderencia === "exata" ? "Atende" : "Similar"}
          </Selo>
          {item.ut.uf === ufRequisicao ? <Selo variante="info">Mesma UF</Selo> : null}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {item.rm ? `RM ${item.rm} · ` : ""}
          {item.marca} · {item.modelo} · {ROTULO_ESTADO[item.estado]}
        </p>
        <p className="text-sm">
          <span className="font-medium">{rotuloUt(item.ut)}</span>
          <span className="text-muted-foreground">
            {" "}
            · {formatarQuantidade(item.quantidadeDisponivel, item.unidade)} disponível
            {rec.quantidadeSugerida > 0
              ? ` · sugerido: ${formatarQuantidade(rec.quantidadeSugerida, item.unidade)}`
              : ""}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {comIa ? <TagIa className="mr-1.5 align-middle">IA</TagIa> : null}
          {rec.justificativa}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {item.naVitrine ? (
            <>
              <Button asChild variant="link" className="text-xs">
                <Link href={`/vitrine/${item.id}`}>Ver na vitrine</Link>
              </Button>
              {item.quantidadeDisponivel < rec.quantidadeSugerida ? (
                <span className="text-destructive">
                  Agora só há {formatarQuantidade(item.quantidadeDisponivel, item.unidade)} disponível.
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-destructive">Não está mais disponível na vitrine.</span>
          )}
        </div>
      </div>
    </li>
  );
}

type LinhaProps = {
  linha: LinhaRequisicaoDto;
  indice: number;
  analisada: boolean;
  comIa: boolean;
  ufRequisicao: string;
};

function Linha({ linha, indice, analisada, comIa, ufRequisicao }: LinhaProps) {
  const uts = new Set(linha.recomendacoes.map((rec) => rec.item.ut.id)).size;
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Item {indice + 1}</p>
          <p className="text-base font-medium">
            {formatarQuantidade(linha.quantidade, linha.unidade)} · {linha.descricao}
          </p>
          {linha.observacao ? <p className="text-xs text-muted-foreground">{linha.observacao}</p> : null}
        </div>
        {analisada ? (
          <div className="flex flex-wrap gap-1.5">
            {linha.quantidadeReuso > 0 ? (
              <Selo variante="ok">{formatarQuantidade(linha.quantidadeReuso, linha.unidade)} por reuso</Selo>
            ) : null}
            {linha.quantidadeComprar > 0 ? (
              <Selo variante="atencao">{formatarQuantidade(linha.quantidadeComprar, linha.unidade)} a comprar</Selo>
            ) : null}
          </div>
        ) : null}
      </div>

      {!analisada ? null : linha.recomendacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada na vitrine atende este item. Segue para compra.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {uts === 1
              ? "Encontrado em 1 UT."
              : `Encontrado em ${uts} UTs. Escolha a mais próxima para solicitar.`}
          </p>
          <ul className="flex flex-col gap-2">
            {linha.recomendacoes.map((rec) => (
              <Recomendacao key={rec.id} rec={rec} comIa={comIa} ufRequisicao={ufRequisicao} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

// Detalhe da requisição (SPEC §6.6): para cada linha, o que a vitrine tem para reuso (item, UT,
// quantidade sugerida) e o que ainda falta comprar.
export default async function PaginaRequisicao({ params }: PageProps<"/requisicoes/[id]">) {
  const { id } = await params;

  const resultado = await obterRequisicao({ id });
  if (!resultado.ok) {
    if (resultado.codigo === "REQUISICAO_NAO_ENCONTRADA" || resultado.codigo === "VALIDACAO") notFound();
    return (
      <p role="alert" className="text-sm text-destructive">
        {resultado.erro}
      </p>
    );
  }
  const r = resultado.dados;
  const analisada = r.analisadaEm !== null;
  const comReuso = r.linhas.filter((l) => l.quantidadeReuso > 0).length;
  const cobertas = r.linhas.filter((l) => l.quantidadeComprar === 0).length;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-4">
        <Button asChild variant="link">
          <Link href="/requisicoes">
            <Icone nome="chevron_left" />
            Voltar às requisições
          </Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold lg:text-2xl">{r.codigo}</h1>
          <Selo variante={VARIANTE_STATUS[r.status]}>{ROTULO_STATUS_REQUISICAO[r.status]}</Selo>
        </div>
        <AcoesRequisicao id={r.id} status={r.status} acoes={r.acoes} />
      </div>

      <section className="mb-4 grid gap-3 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="block text-xs text-muted-foreground">UT requisitante</span>
          {rotuloUt(r.ut)}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">Solicitante</span>
          {r.solicitante.nome}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">Criada em</span>
          {formatarDataHora(r.criadoEm)}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">Vitrine analisada em</span>
          {r.analisadaEm ? formatarDataHora(r.analisadaEm) : "Ainda não analisada"}
        </p>
        {r.justificativa ? (
          <p className="sm:col-span-2">
            <span className="block text-xs text-muted-foreground">Justificativa</span>
            {r.justificativa}
          </p>
        ) : null}
      </section>

      {analisada ? (
        <section className="mb-4 flex flex-col gap-2 rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium">Reuso encontrado na vitrine</h2>
            {r.analiseComIa ? (
              <TagIa>Recomendado pela IA</TagIa>
            ) : (
              <Selo variante="neutro">Busca por palavras (sem IA)</Selo>
            )}
          </div>
          <p className="text-sm">
            <span className="font-medium">
              {comReuso} de {r.linhas.length}
            </span>{" "}
            {r.linhas.length === 1 ? "item tem" : "itens têm"} opção de reuso em outras UTs
            {cobertas > 0
              ? `; ${cobertas} ${cobertas === 1 ? "pode ser atendido" : "podem ser atendidos"} sem compra`
              : ""}
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Para pedir um item, abra-o na vitrine e use Solicitar. As recomendações não reservam nada.
          </p>
        </section>
      ) : (
        <p className="mb-4 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          Rascunho: ao abrir a requisição, a IA procura na vitrine itens de outras UTs para cada linha.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {r.linhas.map((linha, i) => (
          <Linha
            key={linha.id}
            linha={linha}
            indice={i}
            analisada={analisada}
            comIa={r.analiseComIa}
            ufRequisicao={r.ut.uf}
          />
        ))}
      </ol>
    </div>
  );
}
