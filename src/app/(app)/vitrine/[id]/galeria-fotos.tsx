"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type Foto = { urlPrincipal: string | null; urlMiniatura: string | null };

// Galeria do detalhe (SPEC §6.3): foto principal grande e tira de miniaturas para trocar.
// `<img>` simples: URLs assinadas não passam pelo otimizador do Next.
export function GaleriaFotos({ fotos, nome }: { fotos: Foto[]; nome: string }) {
  const [indice, setIndice] = useState(0);
  const atual = fotos[indice] ?? fotos[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-cinza">
        {atual?.urlPrincipal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={atual.urlPrincipal} alt={nome} className="size-full object-contain" />
        ) : null}
      </div>

      {fotos.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Fotos do item">
          {fotos.map((foto, i) => (
            <li key={i} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
                aria-current={i === indice}
                className={cn(
                  "block size-16 overflow-hidden rounded-md border bg-cinza outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  i === indice ? "border-primary" : "border-border"
                )}
              >
                {foto.urlMiniatura ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foto.urlMiniatura} alt="" className="size-full object-cover" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
