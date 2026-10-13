import * as React from "react"
import { cn } from "cn"

// Campo de formulário (DESIGN §6): rótulo acima (12px medium) com `*` nos obrigatórios,
// ajuda opcional e erro em #da291b 12px abaixo do controle.
type CampoProps = {
  /** `id` do controle; o rótulo aponta para ele. */
  htmlFor: string
  rotulo: string
  obrigatorio?: boolean
  ajuda?: string
  erro?: string
  className?: string
  children: React.ReactNode
}

function Campo({ htmlFor, rotulo, obrigatorio, ajuda, erro, className, children }: CampoProps) {
  return (
    <div data-slot="campo" className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {rotulo}
        {obrigatorio ? (
          <span aria-hidden className="ml-0.5">
            *
          </span>
        ) : null}
      </label>
      {children}
      {ajuda && !erro ? <p className="text-xs text-muted-foreground">{ajuda}</p> : null}
      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  )
}

export { Campo }
