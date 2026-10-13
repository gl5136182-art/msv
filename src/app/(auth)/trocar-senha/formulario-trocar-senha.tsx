"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { trocarSenha } from "@/modules/usuarios/usuarios.actions";
import {
  SENHA_TAMANHO_MINIMO,
  trocarSenhaSchema,
  type TrocarSenhaEntrada,
} from "@/modules/usuarios/usuarios.schemas";

export function FormularioTrocarSenha() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TrocarSenhaEntrada>({
    resolver: zodResolver(trocarSenhaSchema),
    defaultValues: { senhaAtual: "", novaSenha: "", confirmacao: "" },
  });

  async function aoEnviar(dados: TrocarSenhaEntrada) {
    setErro(null);
    const resultado = await trocarSenha(dados);

    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} noValidate className="mt-4 flex flex-col gap-4">
      <Campo htmlFor="senhaAtual" rotulo="Senha atual" obrigatorio erro={errors.senhaAtual?.message}>
        <Input
          id="senhaAtual"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.senhaAtual ? true : undefined}
          {...register("senhaAtual")}
        />
      </Campo>

      <Campo
        htmlFor="novaSenha"
        rotulo="Nova senha"
        obrigatorio
        ajuda={`No mínimo ${SENHA_TAMANHO_MINIMO} caracteres.`}
        erro={errors.novaSenha?.message}
      >
        <Input
          id="novaSenha"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.novaSenha ? true : undefined}
          {...register("novaSenha")}
        />
      </Campo>

      <Campo htmlFor="confirmacao" rotulo="Confirmar nova senha" obrigatorio erro={errors.confirmacao?.message}>
        <Input
          id="confirmacao"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmacao ? true : undefined}
          {...register("confirmacao")}
        />
      </Campo>

      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
