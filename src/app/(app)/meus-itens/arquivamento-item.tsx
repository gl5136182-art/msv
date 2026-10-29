"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmarAcao } from "@/components/confirmar-acao";
import { Button } from "@/components/ui/button";
import { alterarArquivamento } from "@/modules/itens/itens.actions";
import type { StatusItem } from "@/modules/itens/itens.schemas";

// Arquivar retira o item da vitrine; reativar o devolve (SPEC §3, regra 4).
export function ArquivamentoItem({ itemId, status }: { itemId: string; status: StatusItem }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [processando, iniciar] = useTransition();

  const arquivado = status === "arquivado";

  function executar() {
    iniciar(async () => {
      const resultado = await alterarArquivamento({ id: itemId, arquivar: !arquivado });
      setConfirmando(false);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(arquivado ? "Item reativado." : "Item arquivado.");
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <h2 className="text-base font-medium">{arquivado ? "Item arquivado" : "Arquivar item"}</h2>
      <p className="text-sm text-muted-foreground">
        {arquivado
          ? "Este item não aparece na vitrine. Reative para que outras UTs voltem a encontrá-lo."
          : "Retira o item da vitrine. Você pode reativar depois."}
      </p>
      <div>
        <Button
          type="button"
          variant={arquivado ? "default" : "secondary"}
          onClick={() => (arquivado ? executar() : setConfirmando(true))}
          disabled={processando}
        >
          {arquivado ? (processando ? "Reativando…" : "Reativar item") : "Arquivar item"}
        </Button>
      </div>

      <ConfirmarAcao
        aberto={confirmando}
        aoMudar={setConfirmando}
        titulo="Arquivar item"
        consequencia="O item sai da vitrine e deixa de aparecer para as outras UTs."
        rotuloConfirmar="Arquivar"
        destrutiva
        aoConfirmar={executar}
        processando={processando}
      />
    </section>
  );
}
