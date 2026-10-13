"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { criarCategoria, renomearCategoria } from "@/modules/categorias/categorias.actions";
import {
  categoriaSchema,
  type CategoriaDto,
  type CategoriaEntrada,
} from "@/modules/categorias/categorias.schemas";

type FormularioCategoriaProps = {
  /** Categoria em edição (renomear); sem ela o formulário cria uma nova. */
  categoria: CategoriaDto | null;
  aoConcluir: (categoria: CategoriaDto) => void;
  aoCancelar: () => void;
};

export function FormularioCategoria({ categoria, aoConcluir, aoCancelar }: FormularioCategoriaProps) {
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoriaEntrada>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { nome: categoria?.nome ?? "" },
  });

  async function aoEnviar(dados: CategoriaEntrada) {
    setErro(null);
    const resultado = categoria
      ? await renomearCategoria({ id: categoria.id, nome: dados.nome })
      : await criarCategoria(dados);

    if (!resultado.ok) {
      if (resultado.codigo === "NOME_DUPLICADO") setError("nome", { message: resultado.erro });
      else setErro(resultado.erro);
      return;
    }
    aoConcluir(resultado.dados);
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4">
      <Campo htmlFor="categoria-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
        <Input
          id="categoria-nome"
          autoComplete="off"
          maxLength={100}
          aria-invalid={errors.nome ? true : undefined}
          {...register("nome")}
        />
      </Campo>

      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={aoCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
