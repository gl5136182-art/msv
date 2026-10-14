import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Icone } from "@/components/icone";
import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { Button } from "@/components/ui/button";
import { Selo } from "@/components/ui/selo";
import { obterUsuarioLogado } from "@/infra/sessao";
import { formatarMoeda, formatarNumero } from "@/lib/formatacao";
import { listarItensDaUt } from "@/modules/itens/itens.actions";
import {
  ROTULO_CATEGORIA,
  ROTULO_ESTADO,
  type ItemResumoDto,
  type StatusItem,
} from "@/modules/itens/itens.schemas";

export const metadata: Metadata = { title: "Meus itens" };

const SELO_STATUS: Record<StatusItem, { rotulo: string; variante: "ok" | "neutro" }> = {
  disponivel: { rotulo: "Disponível", variante: "ok" },
  esgotado: { rotulo: "Esgotado", variante: "neutro" },
  arquivado: { rotulo: "Arquivado", variante: "neutro" },
};

function BotaoCadastrar() {
  return (
    <Button asChild>
      <Link href="/meus-itens/novo">
        <Icone nome="add" />
        Cadastrar item
      </Link>
    </Button>
  );
}

export default async function PaginaMeusItens() {
  // Só o almoxarife tem "Meus itens" (SPEC §2). A autorização de verdade é feita pelo service.
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.papel !== "almoxarife") notFound();

  const resultado = await listarItensDaUt();

  return (
    <>
      <CabecalhoPagina titulo="Meus itens" acoes={<BotaoCadastrar />} />

      {!resultado.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {resultado.erro}
        </p>
      ) : resultado.dados.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card p-4">
          <p className="text-sm">Nenhum item cadastrado.</p>
          <BotaoCadastrar />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {resultado.dados.map((item) => (
            <LinhaItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}

function LinhaItem({ item }: { item: ItemResumoDto }) {
  const status = SELO_STATUS[item.status];
  return (
    <li>
      <Link
        href={`/meus-itens/${item.id}/editar`}
        className="flex items-center gap-3 rounded-md border border-border bg-card p-3 outline-none transition-colors duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
      >
        <div className="size-16 shrink-0 overflow-hidden rounded-md bg-cinza">
          {item.urlMiniatura ? (
            // URL assinada: o otimizador do Next não cacheia, então <img> simples (SPEC §6.3).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.urlMiniatura} alt="" className="size-full object-cover" />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{item.nome}</span>
            <Selo variante={status.variante}>{status.rotulo}</Selo>
            <Selo variante="contorno">{ROTULO_ESTADO[item.estado]}</Selo>
            {item.solicitacoesPendentes > 0 ? (
              <Selo variante="atencao">
                {item.solicitacoesPendentes === 1
                  ? "1 solicitação pendente"
                  : `${formatarNumero(item.solicitacoesPendentes)} solicitações pendentes`}
              </Selo>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {item.rm ? `RM ${item.rm} · ` : ""}
            {item.marca} · {item.modelo} · {ROTULO_CATEGORIA[item.categoria]}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatarNumero(item.quantidadeDisponivel)} de {formatarNumero(item.quantidadeTotal)} {item.unidade} ·{" "}
            {formatarMoeda(item.valorUnitarioReposicao)}
          </p>
        </div>

        <Icone nome="chevron_right" className="shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
