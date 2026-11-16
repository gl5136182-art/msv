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
import { transferirItem } from "@/modules/itens/itens.actions";
import { ROTULO_UNIDADE, type StatusItem, type Unidade } from "@/modules/itens/itens.schemas";

type TransferenciaItemProps = {
  itemId: string;
  utsDestino: { id: string; rotulo: string }[];
  quantidadeDisponivel: number;
  unidade: Unidade;
  status: StatusItem;
};

// Marca o item (ou parte dele) como transferido: pergunta o destino e a quantidade.
// Transferir tudo muda o status para "Transferido"; transferir parte só desconta do estoque.
export function TransferenciaItem({ itemId, utsDestino, quantidadeDisponivel, unidade, status }: TransferenciaItemProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState("");
  const [quantidade, setQuantidade] = useState(String(quantidadeDisponivel));
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciar] = useTransition();

  const podeTransferir = status !== "transferido" && status !== "arquivado" && quantidadeDisponivel > 0;

  function abrir() {
    setDestino("");
    setQuantidade(String(quantidadeDisponivel));
    setErro(null);
    setAberto(true);
  }

  function confirmar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciar(async () => {
      const resultado = await transferirItem({ id: itemId, destinoUtId: destino, quantidade });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setAberto(false);
      toast.success(
        resultado.dados.status === "transferido"
          ? "Item marcado como transferido."
          : "Transferência registrada. O item continua disponível.",
      );
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h2 className="text-base font-medium">Transferir item</h2>
      <p className="text-sm text-muted-foreground">
        {status === "transferido"
          ? "Todas as unidades deste item foram transferidas."
          : "Registre a saída de unidades para outro lugar. Se sobrarem unidades, o item continua disponível."}
      </p>
      <div>
        <Button type="button" variant="secondary" onClick={abrir} disabled={!podeTransferir}>
          Marcar como transferido
        </Button>
      </div>

      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo="Transferir item"
        rodape={
          <>
            <Button type="button" variant="secondary" onClick={() => setAberto(false)} disabled={processando}>
              Cancelar
            </Button>
            <Button type="submit" form="form-transferencia" disabled={processando}>
              {processando ? "Salvando…" : "Confirmar transferência"}
            </Button>
          </>
        }
      >
        <form id="form-transferencia" onSubmit={confirmar} noValidate className="flex flex-col gap-3">
          <Campo htmlFor="transferencia-destino" rotulo="Para onde o item foi?">
            <Seletor id="transferencia-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Selecione a UT</option>
              {utsDestino.map((ut) => (
                <option key={ut.id} value={ut.id}>
                  {ut.rotulo}
                </option>
              ))}
            </Seletor>
          </Campo>
          <Campo
            htmlFor="transferencia-quantidade"
            rotulo={`Quantidade (disponível: ${formatarNumero(quantidadeDisponivel)} ${ROTULO_UNIDADE[unidade].toLowerCase()})`}
            erro={erro ?? undefined}
          >
            <Input
              id="transferencia-quantidade"
              inputMode="numeric"
              autoComplete="off"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ""))}
              aria-invalid={erro ? true : undefined}
            />
          </Campo>
        </form>
      </Dialogo>
    </section>
  );
}
