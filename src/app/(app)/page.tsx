import { redirect } from "next/navigation";

// A tela inicial é a Vitrine (DESIGN §5).
export default function Inicio() {
  redirect("/vitrine");
}
