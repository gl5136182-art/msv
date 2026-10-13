import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const metadata: Metadata = { title: "Administração" };

export default function Pagina() {
  return <CabecalhoPagina titulo="Administração" />;
}
