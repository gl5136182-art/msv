import { redirect } from "next/navigation";

// A área de administração abre na primeira seção.
export default function Pagina() {
  redirect("/administracao/uts");
}
