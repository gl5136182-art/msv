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
            <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-3">
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

              <span className="text-xs text-muted-foreground">
                Página {vitrine.dados.pagina} de {vitrine.dados.totalPaginas}
              </span>

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
