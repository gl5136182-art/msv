import type { Metadata } from "next";

import { LogoManserv } from "@/components/marca";

import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaLogin() {
  return (
    <section className="rounded-md border border-border bg-card p-6">
      <div className="flex items-center gap-3 text-grafite">
        <LogoManserv altura={20} aria-hidden />
        <span aria-hidden className="h-5 w-px bg-grafite" />
        <span className="text-base font-medium">MSV</span>
      </div>

      <h1 className="mt-6 text-xl font-bold lg:text-2xl">Entrar</h1>

      <FormularioLogin />

      <p className="mt-4 text-xs text-muted-foreground">
        Esqueceu a senha? Peça ao administrador para redefinir.
      </p>
    </section>
  );
}
