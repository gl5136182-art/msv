"use client";

import Form from "next/form";
import { useEffect, useState, type ComponentProps } from "react";

import { Icone } from "@/components/icone";
import { CATEGORIAS_ITEM, ROTULO_CATEGORIA } from "@/modules/itens/itens.schemas";
import {
  PERIODOS,
  ROTULO_PERIODO,
  TODAS_AS_UTS,
  type Periodo,
  type UtFiltroDto,
} from "@/modules/dashboard/dashboard.schemas";
import type { CategoriaItem } from "@/modules/itens/itens.schemas";

type Props = {
  periodo: Periodo;
  /** `null` = "Todas". */
  utId: string | null;
  categoria: CategoriaItem | null;
  uts: UtFiltroDto[];
};

// Select nativo sobre fundo escuro, com borda clara (DESIGN §7, item 2).
function SeletorEscuro({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`h-11 w-full min-w-0 appearance-none rounded-md border border-white/50 bg-grafite pr-10 pl-3 text-sm text-white outline-none transition-colors duration-150 focus-visible:border-white focus-visible:ring-1 focus-visible:ring-white lg:h-10 ${className ?? ""}`}
      >
        {children}
      </select>
      <Icone
        nome="keyboard_arrow_down"
        tamanho={20}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-white"
      />
    </div>
  );
}

function CampoEscuro({ htmlFor, rotulo, children }: { htmlFor: string; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-white">
        {rotulo}
      </label>
      {children}
    </div>
  );
}

// Barra de filtros do dashboard. É um formulário GET: os valores vão para a URL e a página
// (servidor) lê de lá; trocar um select envia na hora. No mobile fica atrás do botão "Filtros",
// num painel lateral escuro (DESIGN §7, item 2). O pai usa `key` para recriar o formulário
// quando a URL muda, porque os selects são não controlados.
export function FiltrosDashboard({ periodo, utId, categoria, uts }: Props) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [aberto]);

  return (
    <div className="bg-grafite px-4 pb-3 text-white">
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-expanded={aberto}
        aria-controls="filtros-dashboard"
        className="flex h-11 items-center gap-2 rounded-md border border-white/50 px-3 text-sm font-medium outline-none focus-visible:ring-1 focus-visible:ring-white lg:hidden"
      >
        <Icone nome="filter_list" tamanho={20} />
        Filtros
      </button>

      {aberto ? (
        <button
          type="button"
          aria-label="Fechar filtros"
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      ) : null}

      <Form
        id="filtros-dashboard"
        action="/dashboard"
        role="search"
        aria-label="Filtros do dashboard"
        onChange={(evento) => {
          if (evento.target instanceof HTMLSelectElement) evento.currentTarget.requestSubmit();
        }}
        onSubmit={() => setAberto(false)}
        className={
          aberto
            ? "fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 bg-grafite p-4 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:flex-row lg:p-0"
            : "hidden lg:grid lg:grid-cols-3 lg:gap-3"
        }
      >
        {aberto ? (
          <div className="flex items-center justify-between lg:hidden">
            <p className="text-base font-medium">Filtros</p>
            <button
              type="button"
              aria-label="Fechar filtros"
              onClick={() => setAberto(false)}
              className="flex size-11 items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-white"
            >
              <Icone nome="close" tamanho={24} />
            </button>
          </div>
        ) : null}

        <CampoEscuro htmlFor="dash-periodo" rotulo="Período">
          <SeletorEscuro id="dash-periodo" name="periodo" defaultValue={periodo}>
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PERIODO[p]}
              </option>
            ))}
          </SeletorEscuro>
        </CampoEscuro>

        <CampoEscuro htmlFor="dash-ut" rotulo="UT">
          <SeletorEscuro id="dash-ut" name="ut" defaultValue={utId ?? TODAS_AS_UTS}>
            <option value={TODAS_AS_UTS}>Todas as UTs</option>
            {uts.map((ut) => (
              <option key={ut.id} value={ut.id}>
                {ut.rotulo}
              </option>
            ))}
          </SeletorEscuro>
        </CampoEscuro>

        <CampoEscuro htmlFor="dash-categoria" rotulo="Categoria">
          <SeletorEscuro id="dash-categoria" name="categoria" defaultValue={categoria ?? ""}>
            <option value="">Todas</option>
            {CATEGORIAS_ITEM.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </SeletorEscuro>
        </CampoEscuro>
      </Form>
    </div>
  );
}
