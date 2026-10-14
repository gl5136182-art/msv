import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Selo } from "@/components/ui/selo";
import { TagIa } from "@/components/ui/tag-ia";
import { formatarData, formatarMoeda, formatarNumero, formatarQuantidade } from "@/lib/formatacao";
import { rotuloUt } from "@/lib/rotulo-ut";
import { obterItemDaVitrine } from "@/modules/itens/itens.actions";
import {
  ROTULO_CATEGORIA,
  ROTULO_ESTADO,
  ROTULO_SEGMENTO,
  type OrigemDimensoes,
} from "@/modules/itens/itens.schemas";

import { BotaoSolicitar } from "./botao-solicitar";
import { GaleriaFotos } from "./galeria-fotos";

export const metadata: Metadata = { title: "Item da vitrine" };

const ROTULO_ORIGEM: Record<OrigemDimensoes, string | null> = {
  manual: null,
  ia: "Recomendado pela IA",
  ia_ajustada: "Recomendado pela IA, ajustado",
};

export default async function PaginaItemDaVitrine({ params }: PageProps<"/vitrine/[id]">) {
  const { id } = await params;

  const resultado = await obterItemDaVitrine(id);
  // Inexistente, esgotado, arquivado ou de UT inativa: a vitrine não distingue.
  if (!resultado.ok) {
    if (resultado.codigo === "ITEM_NAO_ENCONTRADO") notFound();
    return (
      <p role="alert" className="text-sm text-destructive">
        {resultado.erro}
      </p>
    );
  }
  const item = resultado.dados;
  const origem = ROTULO_ORIGEM[item.dimensoesOrigem];

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4">
        <Button asChild variant="link">
          <Link href="/vitrine">
            <Icone nome="chevron_left" />
            Voltar à vitrine
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-3">
          <GaleriaFotos fotos={item.fotos} nome={item.nome} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold">{item.nome}</h1>
              <p className="text-sm text-muted-foreground">
                {item.marca} · {item.modelo}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <Selo variante="contorno">{ROTULO_ESTADO[item.estado]}</Selo>
              <Selo variante="contorno">{ROTULO_CATEGORIA[item.categoria]}</Selo>
              {item.segmento ? <Selo variante="contorno">{ROTULO_SEGMENTO[item.segmento]}</Selo> : null}
              {item.daMinhaUt ? (
                <Selo variante="contorno" className="border-grafite">
                  Sua UT
                </Selo>
              ) : null}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Valor de reposição (unitário)</p>
              <p className="text-xl font-medium">{formatarMoeda(item.valorUnitarioReposicao)}</p>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {item.rm ? (
                <>
                  <dt className="text-muted-foreground">RM</dt>
                  <dd>{item.rm}</dd>
                </>
              ) : null}
              {item.valorDepreciacaoMensal !== null ? (
                <>
                  <dt className="text-muted-foreground">Depreciação</dt>
                  <dd>{formatarMoeda(item.valorDepreciacaoMensal)} por mês</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Disponível</dt>
              <dd>{formatarQuantidade(item.quantidadeDisponivel, item.unidade)}</dd>
              <dt className="text-muted-foreground">Origem</dt>
              <dd>{rotuloUt(item.ut)}</dd>
              <dt className="text-muted-foreground">Cadastrado em</dt>
              <dd>{formatarData(item.criadoEm)}</dd>
            </dl>

            {item.podeSolicitar ? (
              <BotaoSolicitar
                itemId={item.id}
                nome={item.nome}
                quantidadeDisponivel={item.quantidadeDisponivel}
                unidade={item.unidade}
              />
            ) : item.daMinhaUt ? (
              <p className="text-xs text-muted-foreground">Este item é da sua UT.</p>
            ) : null}
          </section>

          {item.descricao ? (
            <section className="rounded-md border border-border bg-card p-4">
              <h2 className="mb-2 text-base font-medium">Descrição</h2>
              <p className="text-sm whitespace-pre-line">{item.descricao}</p>
            </section>
          ) : null}

          <section className="rounded-md border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-medium">Dimensões e peso</h2>
              {origem ? <TagIa>{origem}</TagIa> : null}
            </div>
            <p className="mb-1 text-xs text-muted-foreground">Por unidade</p>
            <MedidasEPeso
              largura={item.larguraCm}
              altura={item.alturaCm}
              profundidade={item.profundidadeCm}
              peso={item.pesoKg}
            />

            {item.lote ? (
              <>
                <p className="mt-3 mb-1 text-xs text-muted-foreground">Lote inteiro</p>
                <MedidasEPeso
                  largura={item.lote.larguraCm}
                  altura={item.lote.alturaCm}
                  profundidade={item.lote.profundidadeCm}
                  peso={item.lote.pesoKg}
                />
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function MedidasEPeso(props: { largura: number; altura: number; profundidade: number; peso: number }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
      <div>
        <dt className="text-xs text-muted-foreground">Largura</dt>
        <dd>{formatarNumero(props.largura, 0, 2)} cm</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Altura</dt>
        <dd>{formatarNumero(props.altura, 0, 2)} cm</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Profundidade</dt>
        <dd>{formatarNumero(props.profundidade, 0, 2)} cm</dd>
      </div>
      <div>
        <dt className="text-xs text-muted-foreground">Peso</dt>
        <dd>{formatarNumero(props.peso, 0, 2)} kg</dd>
      </div>
    </dl>
  );
}
