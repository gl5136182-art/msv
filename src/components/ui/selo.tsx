import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Badge retangular de status (DESIGN §2): raio 4px, texto 12px medium.
const seloVariants = cva("inline-flex h-5 shrink-0 items-center rounded-sm px-2 text-xs font-medium whitespace-nowrap", {
  variants: {
    variante: {
      /** Inativo, esgotado, arquivado. */
      neutro: "bg-status-neutro text-foreground",
      /** Disponível, concluída. */
      ok: "bg-status-ok text-white",
      /** Pendente. */
      atencao: "bg-status-atencao text-foreground",
      /** Aceita. */
      info: "bg-azul text-white",
      /** Recusada, cancelada. */
      erro: "bg-status-erro text-white",
      /** Condição do item e etiquetas como "Sua UT". */
      contorno: "border border-input bg-transparent text-foreground",
    },
  },
  defaultVariants: { variante: "neutro" },
})

function Selo({
  className,
  variante,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof seloVariants>) {
  return <span data-slot="selo" className={cn(seloVariants({ variante }), className)} {...props} />
}

export { Selo }
