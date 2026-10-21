"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { formatarNumero } from "@/lib/formatacao";
import { ROTULO_UNIDADE, type Unidade } from "@/modules/itens/itens.schemas";
import { solicitar } from "@/modules/solicitacoes/solicitacoes.actions";
import { LIMITE_OBSERVACAO } from "@/modules/solicitacoes/solicitacoes.schemas";

type BotaoSolicitarProps = {
  itemId: string;
  nome: string;
  quantidadeDisponivel: number;
  unidade: Unidade;
  /** UTs do solicitante que podem receber o item, a principal primeiro (pelo menos uma). */
  utsDestino: Array<{ id: string; rotulo: string }>;
};

// Modal "Solicitar" (SPEC §6.4): UT de destino, quantidade (de 1 até a disponível) e observação
// opcional. A UT de destino vem preenchida quando o solicitante só tem uma; com mais de uma, ele
// escolhe. A disponibilidade é conferida de novo no servidor, e de novo ao aceitar (regra 6).
export function BotaoSolicitar({ itemId, nome, quantidadeDisponivel, unidade, utsDestino }: BotaoSolicitarProps) {
  const router = useRouter();
  const escolheDestino = utsDestino.length > 1;
  const destinoUnico = escolheDestino ? "" : (utsDestino[0]?.id ?? "");
  const [aberto, setAberto] = useState(false);
  const [utDestinoId, setUtDestinoId] = useState(destinoUnico);
  const [erroUt, setErroUt] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciar] = useTransition();

  const rotuloUnidade = ROTULO_UNIDADE[unidade].toLowerCase();

  function aoMudar(proximo: boolean) {
    // Não fecha no meio do envio: a resposta ainda vai chegar.
    if (processando) return;
    setAberto(proximo);
    if (proximo) {
      setUtDestinoId(destinoUnico);
      setQuantidade("1");
      setObservacao("");
      setErro(null);
      setErroUt(null);
    }
  }

  function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setErroUt(null);

    if (!utDestinoId) {
      setErroUt("Selecione a UT de destino.");
      return;
    }

    const valor = Number(quantidade);
    if (!Number.isInteger(valor) || valor < 1) {
      setErro("Informe a quantidade.");
      return;
    }
    if (valor > quantidadeDisponivel) {
      setErro(`A quantidade máxima é ${formatarNumero(quantidadeDisponivel)}.`);
      return;
    }

    iniciar(async () => {
      const resultado = await solicitar({ itemId, utDestinoId, quantidade: valor, observacao });
      if (!resultado.ok) {
        if (resultado.codigo?.startsWith("UT_DESTINO")) setErroUt(resultado.erro);
        else setErro(resultado.erro);
        return;
      }
      toast.success("Solicitação enviada.");
      setAberto(false);
      router.push("/solicitacoes");
    });
  }

  return (
    <>
      <Button className="w-full" onClick={() => aoMudar(true)}>
        Solicitar
      </Button>

      <Dialogo
        aberto={aberto}
        aoMudar={aoMudar}
        titulo="Solicitar item"
        descricao={nome}
        rodape={
          <>
            <Button variant="secondary" onClick={() => aoMudar(false)} disabled={processando}>
              Cancelar
            </Button>
            <Button type="submit" form="form-solicitar" disabled={processando}>
              {processando ? "Enviando…" : "Enviar solicitação"}
            </Button>
          </>
        }
      >
        <form id="form-solicitar" onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
          {escolheDestino ? (
            <Campo
              htmlFor="solicitar-ut-destino"
              rotulo="UT Destino"
              obrigatorio
              ajuda="Para qual das suas UTs o item vai."
              erro={erroUt ?? undefined}
            >
              <Seletor
                id="solicitar-ut-destino"
                value={utDestinoId}
                onChange={(e) => setUtDestinoId(e.target.value)}
                aria-invalid={erroUt ? true : undefined}
              >
                <option value="">Selecione</option>
                {utsDestino.map((ut) => (
                  <option key={ut.id} value={ut.id}>
                    {ut.rotulo}
                  </option>
                ))}
              </Seletor>
            </Campo>
          ) : (
            <Campo htmlFor="solicitar-ut-destino" rotulo="UT Destino" erro={erroUt ?? undefined}>
              <Input id="solicitar-ut-destino" readOnly value={utsDestino[0]?.rotulo ?? ""} />
            </Campo>
          )}

          <Campo
            htmlFor="solicitar-quantidade"
            rotulo="Quantidade"
            obrigatorio
            ajuda={`Disponível: ${formatarNumero(quantidadeDisponivel)} ${rotuloUnidade}.`}
            erro={erro ?? undefined}
          >
            <Input
              id="solicitar-quantidade"
              inputMode="numeric"
              autoComplete="off"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))}
              aria-invalid={erro ? true : undefined}
            />
          </Campo>

          <Campo
            htmlFor="solicitar-observacao"
            rotulo="Observação"
            ajuda="Opcional. Ex.: para qual obra ou contrato, prazo de que precisa."
          >
            <textarea
              id="solicitar-observacao"
              rows={3}
              maxLength={LIMITE_OBSERVACAO}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Campo>
        </form>
      </Dialogo>
    </>
  );
}
