import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";

import { Icone } from "@/components/icone";
import { LogoManserv } from "@/components/marca";

import { MenuUsuarioServidor } from "./menu-usuario-servidor";
import { SinoNotificacoes } from "./sino-notificacoes";

// Barra superior na cor `--topbar` (DESIGN §5). Desktop: 56px, com busca ao centro.
// A busca é um formulário GET para `/vitrine?q=…`; a vitrine lê o termo do parâmetro `q`.
// O sino busca as notificações no cliente (polling de 60s). O menu do avatar lê a sessão, por
// isso fica atrás de um Suspense.
export function BarraSuperior() {
  return (
    <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center gap-4 bg-topbar px-4 text-topbar-foreground lg:h-14">
      <Link
        href="/"
        aria-label="MSV, página inicial"
        className="flex shrink-0 items-center gap-3 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
      >
        <LogoManserv altura={20} />
        <span aria-hidden className="h-5 w-px bg-white" />
        <span className="text-base font-medium">MSV</span>
      </Link>

      <Form action="/vitrine" role="search" className="mx-auto hidden w-full max-w-xl lg:block">
        <label htmlFor="busca-itens" className="sr-only">
          Buscar itens
        </label>
        <div className="relative">
          <Icone
            nome="search"
            tamanho={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="busca-itens"
            type="search"
            name="q"
            placeholder="Buscar itens"
            autoComplete="off"
            className="h-10 w-full rounded-md border border-transparent bg-white pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-grafite"
          />
        </div>
      </Form>

      <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-0">
        {/* `usePathname()` no sino é dado de runtime: fica atrás de Suspense (cacheComponents). */}
        <Suspense
          fallback={
            <span className="flex size-10 items-center justify-center" aria-hidden>
              <Icone nome="notifications" tamanho={24} />
            </span>
          }
        >
          <SinoNotificacoes />
        </Suspense>
        <Suspense
          fallback={
            <span className="flex size-10 items-center justify-center" aria-hidden>
              <span className="flex size-8 items-center justify-center rounded-full bg-white/40" />
            </span>
          }
        >
          <MenuUsuarioServidor />
        </Suspense>
      </div>
    </header>
  );
}
