import type { Metadata } from "next";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";

export const metadata: Metadata = { title: "Dashboard" };

export default function Pagina() {
  return <CabecalhoPagina titulo="Dashboard" />;
}
