"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icone } from "@/components/icone";
import { cn } from "@/lib/utils";

import { itemEstaAtivo, type ItemNavegacao } from "./itens-navegacao";

// Desktop (≥1024px): trilho branco de 64px só com ícones; ao passar o mouse (ou focar por teclado)
// expande sobre o conteúdo e mostra os rótulos, como no Comunica. Só o foco de teclado
// (:focus-visible) mantém aberto; o foco deixado por um clique não, senão ela não fecharia ao navegar. A coluna de 64px no fluxo da
// página é mantida, então o conteúdo não se mexe. Item ativo = laranja com ícone branco (DESIGN §5).
export function TrilhoLateral({ itens }: { itens: ItemNavegacao[] }) {
  const pathname = usePathname();

  return (
    <div className="relative z-30 hidden w-16 shrink-0 lg:block">
      <nav
        aria-label="Principal"
        className={cn(
          "group/trilho sticky top-14 flex h-[calc(100dvh-3.5rem)] w-16 flex-col gap-2 overflow-hidden border-r border-sidebar-border bg-sidebar px-3 py-3",
          "transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none",
          "hover:w-60 hover:shadow-lg has-[:focus-visible]:w-60 has-[:focus-visible]:shadow-lg",
        )}
      >
        {itens.map((item) => {
          const ativo = itemEstaAtivo(item.href, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.rotulo}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-3 rounded-md px-2 outline-none transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-ring",
                ativo
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icone nome={item.icone} tamanho={24} className="shrink-0" />
              <span
                aria-hidden
                className="whitespace-nowrap text-sm font-medium opacity-0 transition-opacity duration-150 group-hover/trilho:opacity-100 group-has-[:focus-visible]/trilho:opacity-100 motion-reduce:transition-none"
              >
                {item.rotulo}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
