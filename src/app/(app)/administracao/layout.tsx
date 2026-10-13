import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { CabecalhoPagina } from "@/components/layout/cabecalho-pagina";
import { obterUsuarioLogado } from "@/infra/sessao";

import { NavegacaoAdmin } from "./navegacao-admin";

// Área do admin (SPEC §2). Esconde a área de quem não é admin; a autorização de verdade é
// feita por cada service (SPEC §7).
export default function LayoutAdministracao({ children }: { children: ReactNode }) {
  return (
    <>
      <CabecalhoPagina titulo="Administração" />
      <NavegacaoAdmin />
      <Suspense fallback={null}>
        <ApenasAdmin>{children}</ApenasAdmin>
      </Suspense>
    </>
  );
}

async function ApenasAdmin({ children }: { children: ReactNode }) {
  const usuario = await obterUsuarioLogado();
  if (!usuario || usuario.papel !== "admin") notFound();
  return <>{children}</>;
}
