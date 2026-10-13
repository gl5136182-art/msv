import type { Metadata } from "next";

import { listarCategorias } from "@/modules/categorias/categorias.actions";

import { GerenciadorCategorias } from "./gerenciador-categorias";

export const metadata: Metadata = { title: "Categorias · Administração" };

export default async function PaginaCategorias() {
  const resultado = await listarCategorias();
  if (!resultado.ok) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {resultado.erro}
      </p>
    );
  }

  return <GerenciadorCategorias categorias={resultado.dados} />;
}
