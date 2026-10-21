import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioLogado } from "@/infra/sessao";
import { temPapel } from "@/lib/usuario-logado";

import { FormularioItem } from "../formulario-item";

export const metadata: Metadata = { title: "Cadastrar item" };

export default async function PaginaNovoItem() {
  // Só o almoxarife cadastra (SPEC §2). A autorização de verdade é feita pelo service.
  const usuario = await obterUsuarioLogado();
  if (!usuario || !temPapel(usuario.papel, "almoxarife")) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CabecalhoPagina titulo="Cadastrar item" />
      <FormularioItem />
    </div>
  );
}
