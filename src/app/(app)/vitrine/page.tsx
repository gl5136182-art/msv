import Link from "next/link";
import type { Metadata } from "next";

import { Icone } from "@/components/icone";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { formatarNumero } from "@/lib/formatacao";
import { listarVitrine } from "@/modules/itens/itens.actions";
import { listarUtsAtivas } from "@/modules/uts/uts.actions";

import { CardItem } from "./card-item";
import { FiltrosVitrineForm } from "./filtros-vitrine";
import { filtrosDosParametros, hrefVitrine, temFiltros } from "./parametros";

export const metadata: Metadata = { title: "Vitrine" };

// Página atual, vizinhas, primeira e última; lacunas viram reticências (null).
function paginasVisiveis(atual: number, total: number): (number | null)[] {
  const numeros = new Set([1, total, atual - 1, atual, atual + 1]);
  const ordenados = [...numeros].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultado: (number | null)[] = [];
  ordenados.forEach((n, i) => {
    if (i > 0 && n - ordenados[i - 1] > 1) resultado.push(null);
    resultado.push(n);
  });
  return resultado;
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PaginaVitrine({ searchParams }: Props) {
  const filtros = filtrosDosParametros(await searchParams);
  const comFiltros = temFiltros(filtros);

  const [vitrine, uts] = await Promise.all([listarVitrine(filtros), listarUtsAtivas()]);

  const listaUts = uts.ok ? uts.dados : [];
  const ufs = [...new Set(listaUts.map((ut) => ut.uf))].sort();

  return (
    <>
      <CabecalhoPagina titulo="Vitrine" />

      <FiltrosVitrineForm
        key={hrefVitrine(filtros, { pagina: 1 })}
        filtros={filtros}
        uts={listaUts}
        ufs={ufs}
        comFiltros={comFiltros}
      />

      {!vitrine.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {vitrine.erro}
        </p>
      ) : vitrine.dados.itens.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card p-4">
          <p className="text-sm">
            {comFiltros ? "Nenhum item encontrado com esses filtros." : "Nenhum item disponível na vitrine."}
          </p>
          {comFiltros ? (
            <Button asChild variant="secondary">
              <Link href="/vitrine">Limpar filtros</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {formatarNumero(vitrine.dados.total)} {vitrine.dados.total === 1 ? "item" : "itens"}
          </p>

          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {vitrine.dados.itens.map((item) => (
              <CardItem key={item.id} item={item} />
            ))}
          </ul>

          {vitrine.dados.totalPaginas > 1 ? (
            <nav aria-label="Paginação" className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {vitrine.dados.pagina > 1 ? (
                <Button asChild variant="secondary">
                  <Link href={hrefVitrine(filtros, { pagina: vitrine.dados.pagina - 1 })}>
                    <Icone nome="chevron_left" />
                    Anterior
                  </Link>
                </Button>
              ) : (
                <span />
              )}

              <ul className="order-last flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
                {paginasVisiveis(vitrine.dados.pagina, vitrine.dados.totalPaginas).map((n, i) =>
                  n === null ? (
                    <li key={`gap-${i}`} aria-hidden className="px-1 text-sm text-muted-foreground">
                      …
                    </li>
                  ) : (
                    <li key={n}>
                      <Button
                        asChild
                        variant={n === vitrine.dados.pagina ? "default" : "ghost"}
                        size="icon"
                      >
                        <Link
                          href={hrefVitrine(filtros, { pagina: n })}
                          aria-label={`Página ${n}`}
                          aria-current={n === vitrine.dados.pagina ? "page" : undefined}
                        >
                          {n}
                        </Link>
                      </Button>
                    </li>
                  ),
                )}
              </ul>

              {vitrine.dados.pagina < vitrine.dados.totalPaginas ? (
                <Button asChild variant="secondary">
                  <Link href={hrefVitrine(filtros, { pagina: vitrine.dados.pagina + 1 })}>
                    Próxima
                    <Icone nome="chevron_right" />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
