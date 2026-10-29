"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { aplicarMascaraCpf } from "@/lib/cpf";
import { PAPEIS, ROTULO_PAPEL } from "@/lib/usuario-logado";
import type { UtDto } from "@/modules/uts/uts.schemas";
import { criarUsuario, editarUsuario } from "@/modules/usuarios/usuarios.actions";
import {
  criarUsuarioSchema,
  type CredenciaisGeradasDto,
  type CriarUsuarioEntrada,
  type CriarUsuarioFormulario,
  type UsuarioAdminDto,
} from "@/modules/usuarios/usuarios.schemas";

type FormularioUsuarioProps = {
  /** Usuário em edição; sem ele o formulário cria um novo. */
  usuario: UsuarioAdminDto | null;
  /** Só UTs ativas (SPEC §6.0). */
  uts: UtDto[];
  aoCriar: (credenciais: CredenciaisGeradasDto) => void;
  aoEditar: (usuario: UsuarioAdminDto) => void;
  aoCancelar: () => void;
};

// Um formulário para criar e editar. Na edição só papel, UTs e telefone mudam (SPEC §6.0): nome,
// e-mail e CPF aparecem somente leitura.
export function FormularioUsuario({ usuario, uts, aoCriar, aoEditar, aoCancelar }: FormularioUsuarioProps) {
  const [erro, setErro] = useState<string | null>(null);
  const editando = usuario !== null;

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CriarUsuarioFormulario, unknown, CriarUsuarioEntrada>({
    resolver: zodResolver(criarUsuarioSchema),
    defaultValues: {
      nome: usuario?.nome ?? "",
      email: usuario?.email ?? "",
      cpf: usuario?.cpf ?? "",
      telefone: usuario?.telefone ?? "",
      papel: usuario?.papel ?? "colaborador",
      utId: usuario?.utId ?? "",
      utsAdicionais: usuario?.utsAdicionais.map((ut) => ut.id) ?? [],
    },
  });

  const papel = useWatch({ control, name: "papel" });
  const utPrincipal = useWatch({ control, name: "utId" });
  const utsAdicionais = useWatch({ control, name: "utsAdicionais" }) ?? [];

  function alternarUtAdicional(utId: string, marcada: boolean) {
    const proximas = marcada ? [...utsAdicionais, utId] : utsAdicionais.filter((id) => id !== utId);
    setValue("utsAdicionais", proximas, { shouldDirty: true });
  }

  // Na edição a UT atual pode ter sido desativada depois: ela continua selecionável.
  const opcoesDeUt: { id: string; rotulo: string }[] = uts.map((ut) => ({ id: ut.id, rotulo: ut.rotulo }));
  if (usuario?.utId && !opcoesDeUt.some((o) => o.id === usuario.utId)) {
    opcoesDeUt.unshift({ id: usuario.utId, rotulo: `${usuario.utRotulo ?? "UT"} (inativa)` });
  }
  // O mesmo para as adicionais já vinculadas.
  const opcoesAdicionais = [...opcoesDeUt];
  for (const ut of usuario?.utsAdicionais ?? []) {
    if (!opcoesAdicionais.some((o) => o.id === ut.id)) opcoesAdicionais.push({ id: ut.id, rotulo: `${ut.rotulo} (inativa)` });
  }

  async function aoEnviar(dados: CriarUsuarioEntrada) {
    setErro(null);

    if (usuario) {
      const resultado = await editarUsuario({
        id: usuario.id,
        papel: dados.papel,
        utId: dados.utId,
        utsAdicionais: dados.utsAdicionais,
        telefone: dados.telefone,
      });
      if (!resultado.ok) return setErro(resultado.erro);
      return aoEditar(resultado.dados);
    }

    const resultado = await criarUsuario(dados);
    if (!resultado.ok) {
      if (resultado.codigo === "EMAIL_DUPLICADO") setError("email", { message: resultado.erro });
      else if (resultado.codigo === "CPF_DUPLICADO") setError("cpf", { message: resultado.erro });
      else setErro(resultado.erro);
      return;
    }
    aoCriar(resultado.dados);
  }

  const registroCpf = register("cpf");

  return (
    <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4">
      <Campo htmlFor="usuario-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
        <Input
          id="usuario-nome"
          autoComplete="off"
          readOnly={editando}
          aria-invalid={errors.nome ? true : undefined}
          {...register("nome")}
        />
      </Campo>

      <Campo htmlFor="usuario-email" rotulo="E-mail" obrigatorio erro={errors.email?.message}>
        <Input
          id="usuario-email"
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={editando}
          aria-invalid={errors.email ? true : undefined}
          {...register("email")}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo htmlFor="usuario-cpf" rotulo="CPF" obrigatorio erro={errors.cpf?.message}>
          <Input
            id="usuario-cpf"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            readOnly={editando}
            aria-invalid={errors.cpf ? true : undefined}
            {...registroCpf}
            onChange={(evento) => {
              evento.target.value = aplicarMascaraCpf(evento.target.value);
              void registroCpf.onChange(evento);
            }}
          />
        </Campo>

        <Campo htmlFor="usuario-telefone" rotulo="Telefone" erro={errors.telefone?.message}>
          <Input
            id="usuario-telefone"
            type="tel"
            autoComplete="off"
            placeholder="(00) 00000-0000"
            aria-invalid={errors.telefone ? true : undefined}
            {...register("telefone")}
          />
        </Campo>
      </div>

      <Campo htmlFor="usuario-papel" rotulo="Papel" obrigatorio erro={errors.papel?.message}>
        <Seletor id="usuario-papel" aria-invalid={errors.papel ? true : undefined} {...register("papel")}>
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </Seletor>
      </Campo>

      <Campo
        htmlFor="usuario-ut"
        rotulo="UT"
        obrigatorio={papel !== "admin"}
        ajuda={papel === "admin" ? "O administrador pode ficar sem UT." : undefined}
        erro={errors.utId?.message}
      >
        <Seletor id="usuario-ut" aria-invalid={errors.utId ? true : undefined} {...register("utId")}>
          <option value="">{papel === "admin" ? "Sem UT" : "Selecione"}</option>
          {opcoesDeUt.map((ut) => (
            <option key={ut.id} value={ut.id}>
              {ut.rotulo}
            </option>
          ))}
        </Seletor>
      </Campo>

      {utPrincipal && opcoesAdicionais.some((ut) => ut.id !== utPrincipal) ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-medium text-foreground">UTs adicionais</legend>
          <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-input bg-card p-3">
            {opcoesAdicionais
              .filter((ut) => ut.id !== utPrincipal)
              .map((ut) => (
                <label key={ut.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={utsAdicionais.includes(ut.id)}
                    onChange={(e) => alternarUtAdicional(ut.id, e.target.checked)}
                  />
                  {ut.rotulo}
                </label>
              ))}
          </div>
          {errors.utsAdicionais?.message ? (
            <p role="alert" className="text-xs text-destructive">
              {errors.utsAdicionais.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Opcional. O usuário passa a ter acesso também a estas UTs.
            </p>
          )}
        </fieldset>
      ) : null}

      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}

      {editando ? null : (
        <p className="text-xs text-muted-foreground">
          O sistema gera uma senha provisória, exibida uma única vez depois de salvar.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={aoCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : editando ? "Salvar" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
