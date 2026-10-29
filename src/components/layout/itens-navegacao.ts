import type { NomeIcone } from "@/components/icone";
import { temPapel, type Papel } from "@/lib/usuario-logado";

// Itens da navegação principal e quem os vê (DESIGN §5, tabela "Navegação por papel").
export type ItemNavegacao = {
  href: string;
  rotulo: string;
  icone: NomeIcone;
  papeis: readonly Papel[];
};

export const ITENS_NAVEGACAO: readonly ItemNavegacao[] = [
  { href: "/vitrine", rotulo: "Vitrine", icone: "storefront", papeis: ["colaborador", "almoxarife", "admin"] },
  { href: "/meus-itens", rotulo: "Meus itens", icone: "inventory_2", papeis: ["almoxarife"] },
  { href: "/dashboard", rotulo: "Dashboard", icone: "bar_chart", papeis: ["colaborador", "almoxarife", "admin"] },
  { href: "/administracao", rotulo: "Administração", icone: "settings", papeis: ["admin"] },
];

/** Só a ocultação na interface. A autorização de verdade é do service (SPEC §7). */
export function itensDoPapel(papel: Papel): ItemNavegacao[] {
  return ITENS_NAVEGACAO.filter((item) => temPapel(papel, ...item.papeis));
}

export function itemEstaAtivo(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
