import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { obterUsuarioLogado } from "@/infra/sessao";
import { listarSolicitacoes } from "@/modules/solicitacoes/solicitacoes.actions";
import { ABAS_SOLICITACOES, type AbaSolicitacoes } from "@/modules/solicitacoes/solicitacoes.schemas";

import { COLUNAS_SOLICITACAO, LinhaSolicitacao } from "./linha-solicitacao";

export const metadata: Metadata = { title: "Solicitações" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const ROTULO_ABA: Record<AbaSolicitacoes, string> = { minhas: "Minhas", recebidas: "Recebidas" };

function lerAba(valor: string | string[] | undefined): AbaSolicitacoes {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return ABAS_SOLICITACOES.find((aba) => aba === texto) ?? "minhas";
}

export default async function PaginaSolicitacoes({ searchParams }: Props) {
  // Colaborador e almoxarife (DESIGN §5). A autorização de verdade é feita pelo service.
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.papel === "admin") notFound();

  // "Recebidas" é só do almoxarife: para o colaborador, qualquer valor cai em "Minhas".
  const abas: readonly AbaSolicitacoes[] = usuario.papel === "almoxarife" ? ABAS_SOLICITACOES : ["minhas"];
  const pedida = lerAba((await searchParams).aba);
  const aba = abas.includes(pedida) ? pedida : "minhas";

  const resultado = await listarSolicitacoes({ aba });

  return (
    <>
      <CabecalhoPagina titulo="Solicitações" />

      {abas.length > 1 ? (
        <nav aria-label="Solicitações" className="mb-4 flex gap-1 border-b border-border">
          {abas.map((item) => (
            <Link
              key={item}
              href={item === "minhas" ? "/solicitacoes" : `/solicitacoes?aba=${item}`}
              aria-current={item === aba ? "page" : undefined}
              className={
                item === aba
                  ? "-mb-px border-b-2 border-primary px-4 py-2.5 text-sm font-medium"
                  : "-mb-px border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              }
            >
              {ROTULO_ABA[item]}
            </Link>
          ))}
        </nav>
      ) : null}

      {!resultado.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {resultado.erro}
        </p>
      ) : resultado.dados.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card p-4">
          <p className="text-sm">
            {aba === "minhas"
              ? "Você ainda não fez nenhuma solicitação."
              : "Nenhuma solicitação recebida para os itens da sua UT."}
          </p>
          {aba === "minhas" ? (
            <Button asChild variant="secondary">
              <Link href="/vitrine">Ver a vitrine</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div
            aria-hidden
            className={`hidden rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground uppercase lg:mb-2 lg:grid lg:gap-3 ${COLUNAS_SOLICITACAO}`}
          >
            <span>Item</span>
            <span>{aba === "minhas" ? "Origem" : "Solicitante"}</span>
            <span>Quantidade</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          <ul className="flex flex-col gap-2">
            {resultado.dados.map((solicitacao) => (
              <LinhaSolicitacao key={solicitacao.id} solicitacao={solicitacao} aba={aba} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
