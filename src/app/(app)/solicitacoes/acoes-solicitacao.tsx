"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmarAcao } from "@/components/confirmar-acao";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import type { Resultado } from "@/lib/erro-negocio";
import { mascararMoeda } from "@/lib/numeros-ptbr";
import { aceitar, cancelar, concluir, recusar } from "@/modules/solicitacoes/solicitacoes.actions";
import { LIMITE_MOTIVO_RECUSA } from "@/modules/solicitacoes/solicitacoes.schemas";

type AcoesSolicitacaoProps = {
  id: string;
  itemNome: string;
  acoes: { aceitar: boolean; recusar: boolean; cancelar: boolean; concluir: boolean };
};

type Modal = "aceitar" | "recusar" | "cancelar" | "concluir" | null;

// Ações de uma solicitação (SPEC §6.4). Cada uma abre a sua confirmação (DESIGN §6): aceitar e
// cancelar com uma frase de consequência; recusar com o motivo; concluir com o custo do frete.
export function AcoesSolicitacao({ id, itemNome, acoes }: AcoesSolicitacaoProps) {
  const router = useRouter();
  const [modal, setModal] = useState<Modal>(null);
  const [motivo, setMotivo] = useState("");
  const [frete, setFrete] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciar] = useTransition();

  function abrir(proximo: Exclude<Modal, null>) {
    setErro(null);
    setMotivo("");
    setFrete("");
    setModal(proximo);
  }

  function aoMudar(aberto: boolean) {
    // Não fecha no meio do envio: a resposta ainda vai chegar.
    if (!aberto && !processando) setModal(null);
  }

  function executarAcao(chamar: () => Promise<Resultado<unknown>>, mensagemSucesso: string) {
    setErro(null);
    iniciar(async () => {
      const resultado = await chamar();
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success(mensagemSucesso);
      setModal(null);
      router.refresh();
    });
  }

  function aoRecusar(evento: React.FormEvent) {
    evento.preventDefault();
    if (motivo.trim() === "") {
      setErro("Informe o motivo da recusa.");
      return;
    }
    executarAcao(() => recusar({ id, motivo }), "Solicitação recusada.");
  }

  function aoConcluir(evento: React.FormEvent) {
    evento.preventDefault();
    executarAcao(() => concluir({ id, custoFrete: frete }), "Recebimento confirmado.");
  }

  const erroDoModal = (qual: Exclude<Modal, null>) => (modal === qual ? (erro ?? undefined) : undefined);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {acoes.aceitar ? <Button onClick={() => abrir("aceitar")}>Aceitar</Button> : null}
        {acoes.recusar ? (
          <Button variant="secondary" onClick={() => abrir("recusar")}>
            Recusar
          </Button>
        ) : null}
        {acoes.concluir ? <Button onClick={() => abrir("concluir")}>Confirmar recebimento</Button> : null}
        {acoes.cancelar ? (
          <Button variant="secondary" onClick={() => abrir("cancelar")}>
            Cancelar
          </Button>
        ) : null}
      </div>

      <ConfirmarAcao
        aberto={modal === "aceitar"}
        aoMudar={aoMudar}
        titulo="Aceitar solicitação"
        consequencia={
          erroDoModal("aceitar") ? (
            <span role="alert" className="text-destructive">
              {erroDoModal("aceitar")}
            </span>
          ) : (
            <>
              A quantidade solicitada de <strong>{itemNome}</strong> sai do estoque disponível. As duas UTs passam a
              ver os contatos uma da outra.
            </>
          )
        }
        rotuloConfirmar="Aceitar"
        aoConfirmar={() => executarAcao(() => aceitar({ id }), "Solicitação aceita.")}
        processando={processando}
      />

      <ConfirmarAcao
        aberto={modal === "cancelar"}
        aoMudar={aoMudar}
        titulo="Cancelar solicitação"
        consequencia={
          erroDoModal("cancelar") ? (
            <span role="alert" className="text-destructive">
              {erroDoModal("cancelar")}
            </span>
          ) : (
            <>
              A solicitação de <strong>{itemNome}</strong> será cancelada. Se já estiver aceita, a quantidade volta ao
              estoque do item.
            </>
          )
        }
        rotuloConfirmar="Cancelar solicitação"
        destrutiva
        aoConfirmar={() => executarAcao(() => cancelar({ id }), "Solicitação cancelada.")}
        processando={processando}
      />

      <Dialogo
        aberto={modal === "recusar"}
        aoMudar={aoMudar}
        titulo="Recusar solicitação"
        descricao={itemNome}
        rodape={
          <>
            <Button variant="secondary" onClick={() => aoMudar(false)} disabled={processando}>
              Voltar
            </Button>
            <Button type="submit" form={`form-recusar-${id}`} variant="destructive" disabled={processando}>
              {processando ? "Aguarde…" : "Recusar"}
            </Button>
          </>
        }
      >
        <form id={`form-recusar-${id}`} onSubmit={aoRecusar} noValidate>
          <Campo
            htmlFor={`recusar-motivo-${id}`}
            rotulo="Motivo da recusa"
            obrigatorio
            ajuda="O solicitante vê este texto."
            erro={erroDoModal("recusar")}
          >
            <textarea
              id={`recusar-motivo-${id}`}
              rows={3}
              maxLength={LIMITE_MOTIVO_RECUSA}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={erroDoModal("recusar") ? true : undefined}
              className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring aria-invalid:border-destructive"
            />
          </Campo>
        </form>
      </Dialogo>

      <Dialogo
        aberto={modal === "concluir"}
        aoMudar={aoMudar}
        titulo="Confirmar recebimento"
        descricao={itemNome}
        rodape={
          <>
            <Button variant="secondary" onClick={() => aoMudar(false)} disabled={processando}>
              Voltar
            </Button>
            <Button type="submit" form={`form-concluir-${id}`} disabled={processando}>
              {processando ? "Aguarde…" : "Confirmar recebimento"}
            </Button>
          </>
        }
      >
        <form id={`form-concluir-${id}`} onSubmit={aoConcluir} noValidate>
          <Campo
            htmlFor={`concluir-frete-${id}`}
            rotulo="Custo do frete"
            ajuda="Opcional. Em branco vale R$ 0,00. O frete é pago pela UT de destino."
            erro={erroDoModal("concluir")}
          >
            <Input
              id={`concluir-frete-${id}`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="R$ 0,00"
              value={frete}
              onChange={(e) => setFrete(mascararMoeda(e.target.value))}
              aria-invalid={erroDoModal("concluir") ? true : undefined}
            />
          </Campo>
        </form>
      </Dialogo>
    </>
  );
}
