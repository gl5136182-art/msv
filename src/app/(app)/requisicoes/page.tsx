import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Icone } from "@/components/icone";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Selo } from "@/components/ui/selo";
import { obterUsuarioLogado } from "@/infra/sessao";
import { formatarDataHora } from "@/lib/formatacao";
import { rotuloUt } from "@/lib/rotulo-ut";
import { temPapel } from "@/lib/usuario-logado";
import { listarRequisicoes } from "@/modules/requisicoes/requisicoes.actions";
import { ROTULO_STATUS_REQUISICAO, type RequisicaoResumoDto } from "@/modules/requisicoes/requisicoes.schemas";

import { VARIANTE_STATUS } from "./status";

export const metadata: Metadata = { title: "Requisições" };

const COLUNAS = "lg:grid-cols-[9rem_minmax(0,2fr)_minmax(0,2fr)_12rem_11rem]";

function Cobertura({ r }: { r: RequisicaoResumoDto }) {
  if (!r.analisadaEm) return <span className="text-xs text-muted-foreground">Ainda não analisada</span>;
  return (
    <span className="text-xs">
      <span className="font-medium">
        {r.linhasComReuso} de {r.totalLinhas}
      </span>{" "}
      <span className="text-muted-foreground">
        {r.totalLinhas === 1 ? "item" : "itens"} com reuso
        {r.linhasCobertas > 0 ? ` (${r.linhasCobertas} completo${r.linhasCobertas === 1 ? "" : "s"})` : ""}
      </span>
    </span>
  );
}

export default async function PaginaRequisicoes() {
  // Colaborador e almoxarife abrem; o admin consulta (DESIGN §5). A autorização é do service.
  const usuario = await obterUsuarioLogado();
  if (!usuario || !temPapel(usuario.papel, "colaborador", "almoxarife", "admin")) notFound();
  const podeAbrir = temPapel(usuario.papel, "colaborador", "almoxarife");

  const resultado = await listarRequisicoes();

  return (
    <>
      <CabecalhoPagina
        titulo="Requisições"
        acoes={
          podeAbrir ? (
            <Button asChild>
              <Link href="/requisicoes/nova">
                <Icone nome="add" />
                Nova requisição
              </Link>
            </Button>
          ) : null
        }
      />
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        Antes de comprar, a IA procura na vitrine itens de outras UTs que atendem cada linha da requisição.
      </p>

      {!resultado.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {resultado.erro}
        </p>
      ) : resultado.dados.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card p-4">
          <p className="text-sm">Nenhuma requisição ainda.</p>
          {podeAbrir ? (
            <Button asChild variant="secondary">
              <Link href="/requisicoes/nova">Abrir a primeira</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            aria-hidden
            className={`hidden rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground uppercase lg:mb-2 lg:grid lg:gap-3 ${COLUNAS}`}
          >
            <span>Número</span>
            <span>UT</span>
            <span>Reuso na vitrine</span>
            <span>Status</span>
            <span>Aberta em</span>
          </div>
          <ul className="flex flex-col gap-2">
            {resultado.dados.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requisicoes/${r.id}`}
                  className={`grid gap-2 rounded-md border border-border bg-card p-3 transition-colors hover:bg-accent lg:items-center lg:gap-3 ${COLUNAS}`}
                >
                  <span className="text-sm font-medium">{r.codigo}</span>
                  <span className="min-w-0 text-xs text-muted-foreground">
                    <span className="line-clamp-1">{rotuloUt(r.ut)}</span>
                    {r.solicitante.nome !== usuario.nome ? (
                      <span className="line-clamp-1">Por {r.solicitante.nome}</span>
                    ) : null}
                  </span>
                  <Cobertura r={r} />
                  <span>
                    <Selo variante={VARIANTE_STATUS[r.status]}>{ROTULO_STATUS_REQUISICAO[r.status]}</Selo>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatarDataHora(r.criadoEm)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
