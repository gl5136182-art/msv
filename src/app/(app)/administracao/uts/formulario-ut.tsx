"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { UFS } from "@/lib/ufs";
import { criarUt, editarUt } from "@/modules/uts/uts.actions";
import {
  utSchema,
  type UtDto,
  type UtEntrada,
  type UtFormulario as UtFormularioValores,
} from "@/modules/uts/uts.schemas";

type FormularioUtProps = {
  /** UT em edição; sem ela o formulário cria uma nova. */
  ut: UtDto | null;
  aoConcluir: (ut: UtDto) => void;
  aoCancelar: () => void;
};

export function FormularioUt({ ut, aoConcluir, aoCancelar }: FormularioUtProps) {
  const [erro, setErro] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UtFormularioValores, unknown, UtEntrada>({
    resolver: zodResolver(utSchema),
    defaultValues: {
      codigo: ut?.codigo ?? "",
      nome: ut?.nome ?? "",
      cidade: ut?.cidade ?? "",
      uf: ut?.uf ?? "",
      cep: ut?.cep ?? "",
      logradouro: ut?.logradouro ?? "",
      numero: ut?.numero ?? "",
      complemento: ut?.complemento ?? "",
      bairro: ut?.bairro ?? "",
    },
  });

  async function aoEnviar(dados: UtEntrada) {
    setErro(null);
    const resultado = ut ? await editarUt({ ...dados, id: ut.id }) : await criarUt(dados);

    if (!resultado.ok) {
      if (resultado.codigo === "CODIGO_DUPLICADO") {
        setError("codigo", { message: resultado.erro });
      } else {
        setErro(resultado.erro);
      }
      return;
    }
    aoConcluir(resultado.dados);
  }

  return (
    <form onSubmit={handleSubmit(aoEnviar)} noValidate className="flex flex-col gap-4">
      <Campo
        htmlFor="ut-codigo"
        rotulo="Código"
        obrigatorio
        ajuda="Número da UT na Manserv, com pontos. Ex.: 06.00.0171.256"
        erro={errors.codigo?.message}
      >
        <Input
          id="ut-codigo"
          autoComplete="off"
          inputMode="text"
          maxLength={20}
          aria-invalid={errors.codigo ? true : undefined}
          {...register("codigo")}
        />
      </Campo>

      <Campo htmlFor="ut-nome" rotulo="Nome" obrigatorio erro={errors.nome?.message}>
        <Input
          id="ut-nome"
          autoComplete="off"
          aria-invalid={errors.nome ? true : undefined}
          {...register("nome")}
        />
      </Campo>

      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <Campo htmlFor="ut-cidade" rotulo="Cidade" obrigatorio erro={errors.cidade?.message}>
          <Input
            id="ut-cidade"
            autoComplete="off"
            aria-invalid={errors.cidade ? true : undefined}
            {...register("cidade")}
          />
        </Campo>

        <Campo htmlFor="ut-uf" rotulo="UF" obrigatorio erro={errors.uf?.message}>
          <Seletor id="ut-uf" aria-invalid={errors.uf ? true : undefined} {...register("uf")}>
            <option value="">Selecione</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Seletor>
        </Campo>
      </div>

      <fieldset className="flex flex-col gap-4 border-t border-border pt-4">
        <legend className="px-0 text-sm font-medium">Endereço para cotação de frete</legend>
        <p className="-mt-3 text-xs text-muted-foreground">
          Opcional no cadastro. O CEP será necessário para calcular o frete.
        </p>

        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <Campo htmlFor="ut-cep" rotulo="CEP" erro={errors.cep?.message}>
            <Input
              id="ut-cep"
              autoComplete="postal-code"
              inputMode="numeric"
              maxLength={9}
              placeholder="00000-000"
              aria-invalid={errors.cep ? true : undefined}
              {...register("cep")}
            />
          </Campo>

          <Campo htmlFor="ut-logradouro" rotulo="Logradouro" erro={errors.logradouro?.message}>
            <Input id="ut-logradouro" autoComplete="street-address" maxLength={150} {...register("logradouro")} />
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
          <Campo htmlFor="ut-numero" rotulo="Número" erro={errors.numero?.message}>
            <Input id="ut-numero" maxLength={20} {...register("numero")} />
          </Campo>

          <Campo htmlFor="ut-bairro" rotulo="Bairro" erro={errors.bairro?.message}>
            <Input id="ut-bairro" maxLength={100} {...register("bairro")} />
          </Campo>
        </div>

        <Campo htmlFor="ut-complemento" rotulo="Complemento" erro={errors.complemento?.message}>
          <Input id="ut-complemento" maxLength={100} {...register("complemento")} />
        </Campo>
      </fieldset>

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
