import { Suspense } from "react";

import { BarraSuperior } from "@/components/layout/barra-superior";
import { NavegacaoInferiorServidor, TrilhoLateralServidor } from "@/components/layout/navegacao-servidor";

// Casca das telas autenticadas (DESIGN §5): barra superior + conteúdo, com trilho lateral no desktop
// e navegação inferior no mobile. As navegações dependem da sessão (papel) e do pathname, por isso
// ficam atrás de Suspense (cacheComponents): o prerender não as bloqueia.
export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BarraSuperior />
      <div className="flex flex-1">
        <Suspense fallback={<div className="hidden w-16 shrink-0 border-r border-sidebar-border bg-sidebar lg:block" />}>
          <TrilhoLateralServidor />
        </Suspense>
        {/* No mobile, reserva o espaço da navegação inferior (56px + área segura). */}
        <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="mx-auto w-full max-w-[1280px] p-4 lg:p-6">{children}</div>
        </main>
      </div>
      <Suspense fallback={null}>
        <NavegacaoInferiorServidor />
      </Suspense>
    </div>
  );
}
