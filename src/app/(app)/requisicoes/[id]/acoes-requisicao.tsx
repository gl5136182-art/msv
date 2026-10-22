"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Seletor } from "@/components/ui/seletor";
import { analisarRequisicao, encerrarRequisicao } from "@/modules/requisicoes/requisicoes.actions";
import {
  ENCERRAMENTOS,
  ROTULO_ENCERRAMENTO,
  type AcoesRequisicao as Acoes,
  type Encerramento,
  type StatusRequisicao,
} from "@/modules/requisicoes/requisicoes.schemas";

type Props = { id: string; status: StatusRequisicao; acoes: Acoes };

// Ações do solicitante (SPEC §6.6): editar o rascunho, abrir/reanalisar a vitrine e encerrar.
export function AcoesRequisicao({ id, status, acoes }: Props) {
  const router = useRouter();
  const [analisando, iniciarAnalise] = useTransition();
  const [encerrando, iniciarEncerramento] = useTransition();
  const [modal, setModal] = useState(false);
  const opcoes: readonly Encerramento[] = status === "rascunho" ? ["cancelada"] : ENCERRAMENTOS;
  const [escolha, setEscolha] = useState<Encerramento>(opcoes[0]);
  const [erro, setErro] = useState<string | null>(null);

  // O rascunho é aberto pela mesma ação de análise.
  const podeAbrir = status === "rascunho" && acoes.editar;
  if (!acoes.editar && !acoes.analisar && !acoes.encerrar) return null;

  function analisar() {
    iniciarAnalise(async () => {
      const resultado = await analisarRequisicao({ id });
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(podeAbrir ? "Requisição aberta." : "Vitrine analisada de novo.");
      router.refresh();
    });
  }

  function encerrar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciarEncerramento(async () => {
      const resultado = await encerrarRequisicao({ id, status: escolha });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success(escolha === "cancelada" ? "Requisição cancelada." : "Requisição encerrada.");
      setModal(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {acoes.editar ? (
          <Button asChild variant="secondary">
            <Link href={`/requisicoes/${id}/editar`}>
              <Icone nome="edit" />
              Editar
            </Link>
          </Button>
        ) : null}
        {acoes.encerrar ? (
          <Button
            variant="secondary"
            disabled={analisando}
            onClick={() => {
              setEscolha(opcoes[0]);
              setErro(null);
              setModal(true);
            }}
          >
            {status === "rascunho" ? "Cancelar rascunho" : "Encerrar"}
          </Button>
        ) : null}
        {acoes.analisar || podeAbrir ? (
          <Button onClick={analisar} disabled={analisando}>
            <Icone nome={podeAbrir ? "search" : "refresh"} />
            {analisando ? "Buscando na vitrine…" : podeAbrir ? "Abrir e buscar na vitrine" : "Buscar de novo na vitrine"}
          </Button>
        ) : null}
      </div>

      <Dialogo
        aberto={modal}
        aoMudar={(aberto) => {
          if (!encerrando) setModal(aberto);
        }}
        titulo={status === "rascunho" ? "Cancelar rascunho" : "Encerrar requisição"}
        descricao="Depois de encerrada, a requisição não pode ser alterada nem analisada de novo."
        rodape={
          <>
            <Button variant="secondary" onClick={() => setModal(false)} disabled={encerrando}>
              Voltar
            </Button>
            <Button
              type="submit"
              form="form-encerrar"
              variant={escolha === "cancelada" ? "destructive" : "default"}
              disabled={encerrando}
            >
              {encerrando ? "Aguarde…" : "Confirmar"}
            </Button>
          </>
        }
      >
        <form id="form-encerrar" onSubmit={encerrar} className="flex flex-col gap-4">
          <Campo htmlFor="encerrar-como" rotulo="Como foi resolvida" erro={erro ?? undefined}>
            <Seletor id="encerrar-como" value={escolha} onChange={(e) => setEscolha(e.target.value as Encerramento)}>
              {opcoes.map((o) => (
                <option key={o} value={o}>
                  {ROTULO_ENCERRAMENTO[o]}
                </option>
              ))}
            </Seletor>
          </Campo>
        </form>
      </Dialogo>
    </>
  );
}
