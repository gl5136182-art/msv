import { obterUsuarioLogado } from "@/infra/sessao";
import { ROTULO_PAPEL } from "@/lib/usuario-logado";
import { obterRotuloDaUt } from "@/modules/uts/uts.service";

import { MenuUsuario } from "./menu-usuario";

// Lê a sessão (dado de requisição): o chamador deve envolver em <Suspense> (cacheComponents).
export async function MenuUsuarioServidor() {
  const usuario = await obterUsuarioLogado();
  if (!usuario) return null;

  const rotuloDaUt = await obterRotuloDaUt(usuario.utId);

  return <MenuUsuario nome={usuario.nome} detalhe={rotuloDaUt ?? ROTULO_PAPEL[usuario.papel]} />;
}
