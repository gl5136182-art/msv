"use client"

import type { ReactNode } from "react"
import { Dialog } from "radix-ui"
import { cn } from "cn"

import { Icone } from "@/components/icone"

// Modal (DESIGN §6): título, conteúdo e rodapé de ações. Sem animação de entrada (DESIGN §1).
// No mobile fica perto do topo, para o teclado não cobrir os campos.
type DialogoProps = {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  titulo: string
  descricao?: string
  children?: ReactNode
  className?: string
  /** Botões de ação, alinhados à direita. */
  rodape?: ReactNode
}

export function Dialogo({ aberto, aoMudar, titulo, descricao, children, className, rodape }: DialogoProps) {
  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-grafite/50" />
        <Dialog.Content
          // Sem descrição o Radix avisaria no console; `undefined` explícito diz que é de propósito.
          {...(descricao ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-4 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 flex-col rounded-md border border-border bg-card outline-none lg:top-1/2 lg:-translate-y-1/2",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-medium">{titulo}</Dialog.Title>
              {descricao ? (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {descricao}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="-mt-1 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Icone nome="close" tamanho={20} />
            </Dialog.Close>
          </div>

          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div> : null}

          {rodape ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3">{rodape}</div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
