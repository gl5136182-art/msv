import type { ReactNode } from "react";

// Linha de título da página: título à esquerda, botões de ação à direita (DESIGN §5).
export function CabecalhoPagina({ titulo, acoes }: { titulo: string; acoes?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 lg:mb-6">
      <h1 className="text-xl font-bold lg:text-2xl">{titulo}</h1>
      {acoes ? <div className="flex items-center gap-2">{acoes}</div> : null}
    </div>
  );
}
