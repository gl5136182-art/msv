"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmarAcao } from "@/components/confirmar-acao";
import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import { alterarStatusCategoria } from "@/modules/categorias/categorias.actions";
import type { CategoriaDto } from "@/modules/categorias/categorias.schemas";

import { FormularioCategoria } from "./formulario-categoria";

type EstadoFormulario = { aberto: false } | { aberto: true; categoria: CategoriaDto | null };

export function GerenciadorCategorias({ categorias }: { categorias: CategoriaDto[] }) {
  const router = useRouter();
  const [formulario, setFormulario] = useState<EstadoFormulario>({ aberto: false });
  const [paraDesativar, setParaDesativar] = useState<CategoriaDto | null>(null);
  const [processando, iniciar] = useTransition();

  function aoSalvar(categoria: CategoriaDto) {
    toast.success(`Categoria "${categoria.nome}" salva.`);
    setFormulario({ aberto: false });
    router.refresh();
  }

  function alterarStatus(categoria: CategoriaDto, ativo: boolean) {
    iniciar(async () => {
      const resultado = await alterarStatusCategoria({ id: categoria.id, ativo });
      setParaDesativar(null);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(ativo ? "Categoria reativada." : "Categoria desativada.");
      router.refresh();
    });
  }

  const acoes = (categoria: CategoriaDto) => (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Renomear ${categoria.nome}`}
        onClick={() => setFormulario({ aberto: true, categoria })}
      >
        <Icone nome="edit" tamanho={20} />
      </Button>
      {categoria.ativo ? (
        <Button variant="secondary" size="sm" onClick={() => setParaDesativar(categoria)} disabled={processando}>
          Desativar
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => alterarStatus(categoria, true)} disabled={processando}>
          Reativar
        </Button>
      )}
    </>
  );

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {categorias.length} {categorias.length === 1 ? "categoria" : "categorias"}
        </p>
        <Button onClick={() => setFormulario({ aberto: true, categoria: null })}>
          <Icone nome="add" tamanho={20} />
          Nova categoria
        </Button>
      </div>

      {categorias.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-6 text-sm">Nenhuma categoria cadastrada.</div>
      ) : (
        <ul className="overflow-hidden rounded-md border border-border bg-card">
          {categorias.map((categoria) => (
            <li
              key={categoria.id}
              className="flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 py-2 first:border-t-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-medium break-words">{categoria.nome}</span>
                {categoria.ativo ? null : <Selo>Inativa</Selo>}
              </div>
              <div className="flex shrink-0 items-center gap-1">{acoes(categoria)}</div>
            </li>
          ))}
        </ul>
      )}

      <Dialogo
        aberto={formulario.aberto}
        aoMudar={(aberto) => !aberto && setFormulario({ aberto: false })}
        titulo={formulario.aberto && formulario.categoria ? "Renomear categoria" : "Nova categoria"}
      >
        {formulario.aberto ? (
          <FormularioCategoria
            key={formulario.categoria?.id ?? "nova"}
            categoria={formulario.categoria}
            aoConcluir={aoSalvar}
            aoCancelar={() => setFormulario({ aberto: false })}
          />
        ) : null}
      </Dialogo>

      <ConfirmarAcao
        aberto={paraDesativar !== null}
        aoMudar={(aberto) => !aberto && setParaDesativar(null)}
        titulo="Desativar categoria"
        consequencia={
          <>
            <strong>{paraDesativar?.nome}</strong> deixa de aparecer nos formulários e filtros. Os itens
            que já usam essa categoria continuam com ela.
          </>
        }
        rotuloConfirmar="Desativar"
        destrutiva
        processando={processando}
        aoConfirmar={() => paraDesativar && alterarStatus(paraDesativar, false)}
      />
    </div>
  );
}
