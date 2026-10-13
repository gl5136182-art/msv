import { CAMINHOS_ICONES, type NomeIcone } from "./icone-caminhos"

type IconeProps = {
  nome: NomeIcone
  /** 20 no conteúdo e 24 na navegação (DESIGN §4). */
  tamanho?: number
  className?: string
  /** Sem rótulo o ícone é decorativo e fica oculto para leitores de tela. */
  rotulo?: string
}

// Único lugar que conhece a biblioteca de ícones (DESIGN §4). A cor vem do CSS (currentColor).
export function Icone({ nome, tamanho = 20, className, rotulo }: IconeProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={tamanho}
      height={tamanho}
      fill="currentColor"
      className={className}
      role={rotulo ? "img" : undefined}
      aria-label={rotulo}
      aria-hidden={rotulo ? undefined : true}
      focusable="false"
    >
      <path d={CAMINHOS_ICONES[nome]} />
    </svg>
  )
}

export type { NomeIcone }
