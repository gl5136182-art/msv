"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

const SECOES = [
  { href: "/administracao/uts", rotulo: "UTs" },
  { href: "/administracao/usuarios", rotulo: "Usuários" },
];

// Abas das seções de administração. Ativa em laranja com sublinhado (DESIGN §5: laranja marca
// o item ativo).
export function NavegacaoAdmin() {
  return (
    <Suspense fallback={<div className="mb-4 h-11 border-b border-border" aria-hidden />}>
      <Abas />
    </Suspense>
  );
}

function Abas() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administração" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {SECOES.map((secao) => {
        const ativa = pathname === secao.href || pathname.startsWith(`${secao.href}/`);
        return (
          <Link
            key={secao.href}
            href={secao.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "-mb-px flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring",
              ativa
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {secao.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
