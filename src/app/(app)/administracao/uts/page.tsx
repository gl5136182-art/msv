import type { Metadata } from "next";

import { listarUts } from "@/modules/uts/uts.actions";

import { GerenciadorUts } from "./gerenciador-uts";

export const metadata: Metadata = { title: "UTs · Administração" };

export default async function PaginaUts({ searchParams }: PageProps<"/administracao/uts">) {
  const parametros = await searchParams;
  const q = typeof parametros.q === "string" ? parametros.q : "";

  const resultado = await listarUts({ busca: q });
  if (!resultado.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {resultado.erro}
      </p>
    );
  }

  return <GerenciadorUts uts={resultado.dados} busca={q} />;
}
