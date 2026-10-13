import type { NomeIcone } from "@/components/icone";

// Itens da navegação principal (DESIGN §5). A filtragem por papel entra na Fase 1.
export type ItemNavegacao = {
  href: string;
  rotulo: string;
  icone: NomeIcone;
};

export const ITENS_NAVEGACAO: ItemNavegacao[] = [
  { href: "/vitrine", rotulo: "Vitrine", icone: "storefront" },
  { href: "/meus-itens", rotulo: "Meus itens", icone: "inventory_2" },
  { href: "/solicitacoes", rotulo: "Solicitações", icone: "swap_horiz" },
  { href: "/dashboard", rotulo: "Dashboard", icone: "bar_chart" },
  { href: "/administracao", rotulo: "Administração", icone: "settings" },
];

export function itemEstaAtivo(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
