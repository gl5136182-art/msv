"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useTransition } from "react";

import { Icone } from "@/components/icone";
import { sair } from "@/modules/usuarios/usuarios.actions";

// Menu do avatar (DESIGN §5): nome, UT, trocar senha e sair. Abre sobre a barra laranja.
const itemClasse =
  "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-sm px-3 text-sm text-foreground outline-none select-none data-[highlighted]:bg-accent lg:min-h-10";

type MenuUsuarioProps = {
  nome: string;
  /** "Nome da UT · Cidade/UF", ou o papel quando o usuário não tem UT (admin). */
  detalhe: string;
};

export function MenuUsuario({ nome, detalhe }: MenuUsuarioProps) {
  const router = useRouter();
  const [saindo, iniciarSaida] = useTransition();

  function aoSair() {
    iniciarSaida(async () => {
      await sair();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Menu do usuário"
          className="flex size-10 items-center justify-center rounded-md outline-none focus-visible:outline-2 focus-visible:outline-white"
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-white text-grafite">
            <Icone nome="person" tamanho={20} />
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 w-[min(18rem,calc(100vw-1rem))] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium">{nome}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item asChild>
            <Link href="/trocar-senha" className={itemClasse}>
              <Icone nome="key" tamanho={20} />
              Trocar senha
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item className={itemClasse} disabled={saindo} onSelect={aoSair}>
            <Icone nome="logout" tamanho={20} />
            {saindo ? "Saindo…" : "Sair"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
