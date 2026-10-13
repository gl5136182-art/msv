"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { entrar } from "@/modules/usuarios/usuarios.actions";
import { entrarSchema, type EntrarEntrada } from "@/modules/usuarios/usuarios.schemas";

export function FormularioLogin() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EntrarEntrada>({
    resolver: zodResolver(entrarSchema),
    defaultValues: { identificador: "", senha: "" },
  });

  async function aoEnviar(dados: EntrarEntrada) {
    setErro(null);
    const resultado = await entrar(dados);

    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    // O proxy leva para /trocar-senha quando a troca ainda é obrigatória.
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} noValidate className="mt-4 flex flex-col gap-4">
      <Campo htmlFor="identificador" rotulo="E-mail ou CPF" obrigatorio erro={errors.identificador?.message}>
        <Input
          id="identificador"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={errors.identificador ? true : undefined}
          {...register("identificador")}
        />
      </Campo>

      <Campo htmlFor="senha" rotulo="Senha" obrigatorio erro={errors.senha?.message}>
        <Input
          id="senha"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.senha ? true : undefined}
          {...register("senha")}
        />
      </Campo>

      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
