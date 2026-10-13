"use client"

import { Toaster as Sonner } from "sonner"

// Toast discreto no canto (DESIGN §6): sucesso em grafite, erro em #da291b, texto curto, sem
// ícones animados. Fica abaixo da barra superior (52px no mobile, 56px no desktop).
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      offset={{ top: 64, right: 16 }}
      mobileOffset={{ top: 60, right: 12, left: 12 }}
      visibleToasts={3}
      duration={4000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-2 rounded-md bg-grafite px-4 py-3 text-sm font-medium text-white lg:w-[22rem]",
          error: "!bg-destructive",
        },
      }}
    />
  )
}
