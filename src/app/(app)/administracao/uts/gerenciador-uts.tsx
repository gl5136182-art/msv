"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmarAcao } from "@/components/confirmar-acao";
import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Selo } from "@/components/ui/selo";
import { alterarStatusUt } from "@/modules/uts/uts.actions";
import type { UtDto } from "@/modules/uts/uts.schemas";

import { FormularioUt } from "./formulario-ut";

type EstadoFormulario = { aberto: false } | { aberto: true; ut: UtDto | null };

export function GerenciadorUts({ uts, busca }: { uts: UtDto[]; busca: string }) {
  const router = useRouter();
  const [formulario, setFormulario] = useState<EstadoFormulario>({ aberto: false });
  const [paraDesativar, setParaDesativar] = useState<UtDto | null>(null);
  const [processando, iniciar] = useTransition();

  function aoSalvar(ut: UtDto) {
    toast.success(`UT ${ut.codigo} salva.`);
    setFormulario({ aberto: false });
    router.refresh();
  }

  function alterarStatus(ut: UtDto, ativo: boolean) {
    iniciar(async () => {
      const resultado = await alterarStatusUt({ id: ut.id, ativo });
      setParaDesativar(null);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(ativo ? "UT reativada." : "UT desativada.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Form action="/administracao/uts" role="search" className="min-w-0 flex-1 basis-60 lg:max-w-md">
          <label htmlFor="busca-uts" className="sr-only">
            Buscar UT
          </label>
          <div className="relative">
            <Icone
              nome="search"
              tamanho={20}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="busca-uts"
              type="search"
              name="q"
              defaultValue={busca}
              placeholder="Buscar por código, nome ou cidade"
              autoComplete="off"
              className="pl-10"
            />
          </div>
        </Form>

        <Button onClick={() => setFormulario({ aberto: true, ut: null })}>
          <Icone nome="add" tamanho={20} />
          Nova UT
        </Button>
      </div>

      {uts.length === 0 ? (
        <EstadoVazio comBusca={busca !== ""} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {uts.length} {uts.length === 1 ? "UT" : "UTs"}
          </p>

          {/* Desktop: tabela (DESIGN §6). */}
          <div className="hidden overflow-hidden rounded-md border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th className="h-10 px-4 font-medium">Código</th>
                  <th className="h-10 px-4 font-medium">Nome</th>
                  <th className="h-10 px-4 font-medium">Cidade/UF</th>
                  <th className="h-10 px-4 font-medium">Status</th>
                  <th className="h-10 px-4 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {uts.map((ut) => (
                  <tr key={ut.id} className="h-11 border-t border-border">
                    <td className="px-4 tabular-nums">{ut.codigo}</td>
                    <td className="px-4">{ut.nome}</td>
                    <td className="px-4">
                      {ut.cidade}/{ut.uf}
                    </td>
                    <td className="px-4">{ut.ativo ? null : <Selo>Inativa</Selo>}</td>
                    <td className="px-4">
                      <div className="flex items-center justify-end gap-1">
                        <AcoesDaUt
                          ut={ut}
                          aoEditar={() => setFormulario({ aberto: true, ut })}
                          aoDesativar={() => setParaDesativar(ut)}
                          aoReativar={() => alterarStatus(ut, true)}
                          desabilitado={processando}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cada linha vira um card compacto (DESIGN §6). */}
          <ul className="flex flex-col gap-2 lg:hidden">
            {uts.map((ut) => (
              <li key={ut.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{ut.nome}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ut.codigo} · {ut.cidade}/{ut.uf}
                    </p>
                  </div>
                  {ut.ativo ? null : <Selo>Inativa</Selo>}
                </div>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <AcoesDaUt
                    ut={ut}
                    aoEditar={() => setFormulario({ aberto: true, ut })}
                    aoDesativar={() => setParaDesativar(ut)}
                    aoReativar={() => alterarStatus(ut, true)}
                    desabilitado={processando}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialogo
        aberto={formulario.aberto}
        aoMudar={(aberto) => !aberto && setFormulario({ aberto: false })}
        titulo={formulario.aberto && formulario.ut ? "Editar UT" : "Nova UT"}
      >
        {formulario.aberto ? (
          <FormularioUt
            key={formulario.ut?.id ?? "nova"}
            ut={formulario.ut}
            aoConcluir={aoSalvar}
            aoCancelar={() => setFormulario({ aberto: false })}
          />
        ) : null}
      </Dialogo>

      <ConfirmarAcao
        aberto={paraDesativar !== null}
        aoMudar={(aberto) => !aberto && setParaDesativar(null)}
        titulo="Desativar UT"
        consequencia={
          <>
            <strong>{paraDesativar?.nome}</strong> deixa de aparecer nas listas e na vitrine, e as
            solicitações pendentes que a envolvem são canceladas. As aceitas seguem até a conclusão.
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

function AcoesDaUt({
  ut,
  aoEditar,
  aoDesativar,
  aoReativar,
  desabilitado,
}: {
  ut: UtDto;
  aoEditar: () => void;
  aoDesativar: () => void;
  aoReativar: () => void;
  desabilitado: boolean;
}) {
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${ut.nome}`} onClick={aoEditar}>
        <Icone nome="edit" tamanho={20} />
      </Button>
      {ut.ativo ? (
        <Button variant="secondary" size="sm" onClick={aoDesativar} disabled={desabilitado}>
          Desativar
        </Button>
      ) : (
        <Button variant="secondary" size="sm" onClick={aoReativar} disabled={desabilitado}>
          Reativar
        </Button>
      )}
    </>
  );
}

function EstadoVazio({ comBusca }: { comBusca: boolean }) {
  return (
    <div className="rounded-md border border-border bg-card p-6 text-sm">
      {comBusca ? "Nenhuma UT encontrada para essa busca." : "Nenhuma UT cadastrada."}
    </div>
  );
}
