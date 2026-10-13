import Link from "next/link";

import { Selo } from "@/components/ui/selo";
import { formatarMoeda, formatarNumero } from "@/lib/formatacao";
import { ROTULO_CATEGORIA, ROTULO_ESTADO, type ItemVitrineDto } from "@/modules/itens/itens.schemas";

// Card de item da vitrine (DESIGN §6): miniatura 4:3, nome, marca · modelo, condição,
// "qtd · UT · Cidade/UF" em uma linha (a cidade/UF fica sempre visível no fim) e valor de reposição.
export function CardItem({ item }: { item: ItemVitrineDto }) {
  return (
    <li>
      <Link
        href={`/vitrine/${item.id}`}
        className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card outline-none transition-colors duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
      >
        <div className="aspect-[4/3] w-full bg-cinza">
          {item.urlMiniatura ? (
            // URL assinada: o otimizador do Next não cacheia, então <img> simples (SPEC §6.3).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.urlMiniatura} alt="" loading="lazy" className="size-full object-cover" />
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <p className="line-clamp-2 text-sm font-medium">{item.nome}</p>
          {item.rm ? <p className="truncate text-xs text-muted-foreground">RM {item.rm}</p> : null}
          <p className="truncate text-xs text-muted-foreground">
            {item.marca} · {item.modelo}
          </p>

          <div className="flex flex-wrap items-center gap-1">
            <Selo variante="contorno">{ROTULO_ESTADO[item.estado]}</Selo>
            <Selo variante="contorno">{ROTULO_CATEGORIA[item.categoria]}</Selo>
            {item.daMinhaUt ? (
              <Selo variante="contorno" className="border-grafite">
                Sua UT
              </Selo>
            ) : null}
          </div>

          <p className="flex min-w-0 text-xs text-muted-foreground">
            <span className="shrink-0">
              {formatarNumero(item.quantidadeDisponivel)} {item.unidade} ·&nbsp;
            </span>
            <span className="truncate">{item.ut.nome}</span>
            <span className="shrink-0">
              &nbsp;· {item.ut.cidade}/{item.ut.uf}
            </span>
          </p>

          <p className="mt-auto text-sm font-medium">{formatarMoeda(item.valorUnitarioReposicao)}</p>
        </div>
      </Link>
    </li>
  );
}
