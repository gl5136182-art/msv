"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icone } from "@/components/icone";
import { cn } from "@/lib/utils";

import { ITENS_NAVEGACAO, itemEstaAtivo } from "./itens-navegacao";

// Desktop (≥1024px): trilho branco de 64px, só ícones com tooltip. Item ativo = quadrado laranja
// de raio 6px com ícone branco (DESIGN §5).
export function TrilhoLateral() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-16 shrink-0 flex-col items-center gap-2 border-r border-sidebar-border bg-sidebar py-3 lg:flex"
    >
      {ITENS_NAVEGACAO.map((item) => {
        const ativo = itemEstaAtivo(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.rotulo}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "group relative flex size-10 items-center justify-center rounded-md outline-none transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-ring",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <Icone nome={item.icone} tamanho={24} />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-sm bg-grafite px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {item.rotulo}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
