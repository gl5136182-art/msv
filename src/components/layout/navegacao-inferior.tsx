"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icone } from "@/components/icone";
import { cn } from "@/lib/utils";

import { ITENS_NAVEGACAO, itemEstaAtivo } from "./itens-navegacao";

// Mobile (<1024px): navegação fixa no rodapé, ícone + rótulo de 11px, ativo em laranja.
// Respeita a área segura do aparelho (DESIGN §5). O `viewport-fit=cover` está no layout raiz.
export function NavegacaoInferior() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex">
        {ITENS_NAVEGACAO.map((item) => {
          const ativo = itemEstaAtivo(item.href, pathname);
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight outline-none",
                  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  ativo ? "font-medium text-primary" : "text-sidebar-foreground",
                )}
              >
                <Icone nome={item.icone} tamanho={24} />
                <span className="max-w-full truncate">{item.rotulo}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
