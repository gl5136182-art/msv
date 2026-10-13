import * as React from "react"
import { cn } from "cn"

// Tag da IA (DESIGN §6): borda #ffa78b, fundo #ffd7cc, texto #9c3022, 11px. Marca o que foi
// preenchido pela recomendação da IA ("Recomendado pela IA" / "Recomendado pela IA, ajustado").
function TagIa({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tag-ia"
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-sm border border-laranja-45 bg-laranja-25 px-2 text-[11px] font-medium whitespace-nowrap text-laranja-145",
        className
      )}
      {...props}
    />
  )
}

export { TagIa }
