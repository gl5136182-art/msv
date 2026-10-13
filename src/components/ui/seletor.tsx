import * as React from "react"
import { cn } from "cn"

import { Icone } from "@/components/icone"

// Select nativo (abre o seletor do sistema no celular), com o visual dos campos do DESIGN §6.
function Seletor({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="seletor"
        className={cn(
          "h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-card pr-10 pl-3 text-sm text-foreground transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive lg:h-10",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <Icone
        nome="keyboard_arrow_down"
        tamanho={20}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { Seletor }
