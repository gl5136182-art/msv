"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Dialogo } from "@/components/ui/dialogo"

// Confirmação de ação (DESIGN §6): título, uma frase de consequência e dois botões.
type ConfirmarAcaoProps = {
  aberto: boolean
  aoMudar: (aberto: boolean) => void
  titulo: string
  /** Uma frase com a consequência. */
  consequencia: ReactNode
  rotuloConfirmar: string
  aoConfirmar: () => void
  /** Ação destrutiva usa o botão vermelho. */
  destrutiva?: boolean
  processando?: boolean
}

export function ConfirmarAcao({
  aberto,
  aoMudar,
  titulo,
  consequencia,
  rotuloConfirmar,
  aoConfirmar,
  destrutiva,
  processando,
}: ConfirmarAcaoProps) {
  return (
    <Dialogo
      aberto={aberto}
      aoMudar={aoMudar}
      titulo={titulo}
      rodape={
        <>
          <Button variant="secondary" onClick={() => aoMudar(false)} disabled={processando}>
            Cancelar
          </Button>
          <Button variant={destrutiva ? "destructive" : "default"} onClick={aoConfirmar} disabled={processando}>
            {processando ? "Aguarde…" : rotuloConfirmar}
          </Button>
        </>
      }
    >
      <p className="text-sm">{consequencia}</p>
    </Dialogo>
  )
}
