import { Selo } from "@/components/ui/selo";
import { formatarDataHora, formatarMoeda, formatarQuantidade } from "@/lib/formatacao";
import { rotuloUt } from "@/lib/rotulo-ut";
import {
  ROTULO_STATUS_SOLICITACAO,
  type AbaSolicitacoes,
  type SolicitacaoListaDto,
  type StatusSolicitacao,
} from "@/modules/solicitacoes/solicitacoes.schemas";

import { AcoesSolicitacao } from "./acoes-solicitacao";
import { ContatoTransporte } from "./contato-transporte";

const VARIANTE_STATUS: Record<StatusSolicitacao, "atencao" | "info" | "ok" | "erro"> = {
  pendente: "atencao",
  aceita: "info",
  concluida: "ok",
  recusada: "erro",
  cancelada: "erro",
};

/** Colunas da linha no desktop; o cabeçalho da lista usa a mesma grade. */
export const COLUNAS_SOLICITACAO = "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_9rem_10rem_auto]";

/** Data do evento que levou ao status atual. */
function dataDoStatus(s: SolicitacaoListaDto): { rotulo: string; data: string } {
  if (s.status === "concluida" && s.concluidaEm) return { rotulo: "Concluída em", data: s.concluidaEm };
  if (s.status === "cancelada" && s.canceladaEm) return { rotulo: "Cancelada em", data: s.canceladaEm };
  if (s.status === "aceita" && s.respondidaEm) return { rotulo: "Aceita em", data: s.respondidaEm };
  if (s.status === "recusada" && s.respondidaEm) return { rotulo: "Recusada em", data: s.respondidaEm };
  return { rotulo: "Solicitada em", data: s.criadoEm };
}

// Uma solicitação: card compacto no mobile; linha de tabela no desktop (DESIGN §6, Tabelas).
export function LinhaSolicitacao({ solicitacao: s, aba }: { solicitacao: SolicitacaoListaDto; aba: AbaSolicitacoes }) {
  const evento = dataDoStatus(s);
  const temAcoes = s.acoes.aceitar || s.acoes.recusar || s.acoes.cancelar || s.acoes.concluir;

  return (
    <li className="rounded-md border border-border bg-card">
      <div className={`grid gap-3 p-3 lg:items-center ${COLUNAS_SOLICITACAO}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-14 shrink-0 overflow-hidden rounded-md bg-cinza">
            {s.item.urlMiniatura ? (
              // URL assinada: o otimizador do Next não cacheia, então <img> simples (SPEC §6.3).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.item.urlMiniatura} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{s.item.nome}</p>
            <p className="truncate text-xs text-muted-foreground">
              {s.item.rm ? `RM ${s.item.rm} · ` : ""}
              {s.item.marca} · {s.item.modelo}
            </p>
          </div>
        </div>

        <div className="min-w-0 text-xs text-muted-foreground">
          {aba === "minhas" ? (
            <p className="line-clamp-2">
              <span className="font-medium text-foreground">Origem:</span> {rotuloUt(s.utOrigem)}
            </p>
          ) : (
            <>
              <p className="line-clamp-1">
                <span className="font-medium text-foreground">Solicitante:</span> {s.solicitante.nome}
              </p>
              <p className="line-clamp-2">{rotuloUt(s.utDestino)}</p>
            </>
          )}
        </div>

        <div className="text-sm">
          <p>{formatarQuantidade(s.quantidade, s.item.unidade)}</p>
          <p className="text-xs text-muted-foreground">{formatarMoeda(s.quantidade * s.valorUnitario)}</p>
          {s.custoFrete !== null ? (
            <p className="text-xs text-muted-foreground">Frete {formatarMoeda(s.custoFrete)}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-1">
          <Selo variante={VARIANTE_STATUS[s.status]}>{ROTULO_STATUS_SOLICITACAO[s.status]}</Selo>
          <p className="text-xs text-muted-foreground">
            {evento.rotulo} {formatarDataHora(evento.data)}
          </p>
        </div>

        {temAcoes ? <AcoesSolicitacao id={s.id} itemNome={s.item.nome} acoes={s.acoes} /> : <div />}
      </div>

      {s.observacao || s.motivoRecusa || s.contatos ? (
        <div className="flex flex-col gap-2 border-t border-border p-3 text-sm">
          {s.observacao ? (
            <p>
              <span className="text-xs font-medium text-muted-foreground">Observação: </span>
              {s.observacao}
            </p>
          ) : null}
          {s.motivoRecusa ? (
            <p>
              <span className="text-xs font-medium text-muted-foreground">Motivo da recusa: </span>
              {s.motivoRecusa}
            </p>
          ) : null}
          {s.contatos ? (
            <ContatoTransporte
              origem={{ ut: s.utOrigem, contato: s.contatos.origem }}
              destino={{ ut: s.utDestino, contato: s.contatos.destino }}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
