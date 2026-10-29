"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Selo } from "@/components/ui/selo";
import { formatarNumero } from "@/lib/formatacao";
import { ajustarQuantidadeDisponivel } from "@/modules/itens/itens.actions";
import { ROTULO_UNIDADE, type StatusItem, type Unidade } from "@/modules/itens/itens.schemas";

type AjusteQuantidadeProps = {
  itemId: string;
  quantidadeDisponivel: number;
  quantidadeTotal: number;
  unidade: Unidade;
  status: StatusItem;
};

// Ajuste manual da quantidade disponível (SPEC §3, regras 2 e 3), por exemplo quando a própria
// UT usou parte do estoque. Fica separado do formulário de dados: tem ação e confirmação próprias.
export function AjusteQuantidade({
  itemId,
  quantidadeDisponivel,
  quantidadeTotal,
  unidade,
  status,
}: AjusteQuantidadeProps) {
  const router = useRouter();
  const [valor, setValor] = useState(String(quantidadeDisponivel));
  const [erro, setErro] = useState<string | null>(null);
  const [processando, iniciar] = useTransition();

  const mudou = valor.trim() !== "" && valor.trim() !== String(quantidadeDisponivel);

  function aoSalvar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    iniciar(async () => {
      const resultado = await ajustarQuantidadeDisponivel({ id: itemId, quantidadeDisponivel: valor });
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      toast.success(resultado.dados.status === "esgotado" ? "Quantidade atualizada. Item esgotado." : "Quantidade atualizada.");
      setValor(String(resultado.dados.quantidadeDisponivel));
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">Quantidade disponível</h2>
        {status === "esgotado" ? <Selo variante="neutro">Esgotado</Selo> : null}
        {status === "arquivado" ? <Selo variante="neutro">Arquivado</Selo> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Disponível agora: {formatarNumero(quantidadeDisponivel)} de {formatarNumero(quantidadeTotal)}{" "}
        {ROTULO_UNIDADE[unidade].toLowerCase()}. Ajuste quando a sua UT usar parte do estoque.
      </p>

      <form onSubmit={aoSalvar} noValidate className="flex flex-wrap items-end gap-3">
        <Campo
          htmlFor="ajuste-quantidade"
          rotulo="Nova quantidade disponível"
          erro={erro ?? undefined}
          className="w-full sm:w-56"
        >
          <Input
            id="ajuste-quantidade"
            inputMode="numeric"
            autoComplete="off"
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
            aria-invalid={erro ? true : undefined}
          />
        </Campo>
        <Button type="submit" variant="secondary" disabled={processando || !mudou}>
          {processando ? "Salvando…" : "Atualizar quantidade"}
        </Button>
      </form>
    </section>
  );
}
