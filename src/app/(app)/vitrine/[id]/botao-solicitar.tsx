"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { formatarNumero } from "@/lib/formatacao";
import { ROTULO_UNIDADE, type Unidade } from "@/modules/itens/itens.schemas";
import { solicitar } from "@/modules/solicitacoes/solicitacoes.actions";
import { LIMITE_OBSERVACAO } from "@/modules/solicitacoes/solicitacoes.schemas";

type BotaoSolicitarProps = {
  itemId: string;
  nome: string;
  quantidadeDisponivel: number;
  unidade: Unidade;
};

// Modal "Solicitar" (SPEC §6.4): quantidade (de 1 até a disponível) e observação opcional.
// A disponibilidade é conferida de novo no servidor, e de novo ao aceitar (regra 6).
export function BotaoSolicitar({ itemId, nome, quantidadeDisponivel, unidade }: BotaoSolicitarProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
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
      setQuantidade("1");
      setObservacao("");
      setErro(null);
    }
  }

  function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

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
      const resultado = await solicitar({ itemId, quantidade: valor, observacao });
      if (!resultado.ok) {
        setErro(resultado.erro);
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
