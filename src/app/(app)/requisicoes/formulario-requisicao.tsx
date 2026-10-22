"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { ROTULO_UNIDADE, UNIDADES } from "@/modules/itens/itens.schemas";
import { criarRequisicao, editarRequisicao } from "@/modules/requisicoes/requisicoes.actions";
import {
  LIMITE_DESCRICAO_LINHA,
  LIMITE_JUSTIFICATIVA,
  LIMITE_OBSERVACAO_LINHA,
  MAXIMO_LINHAS,
  requisicaoSchema,
  type FormularioRequisicaoDto,
} from "@/modules/requisicoes/requisicoes.schemas";

// O formulário não escolhe "abrir": cada botão decide ao enviar.
const formularioSchema = requisicaoSchema.omit({ abrir: true });
type Valores = z.input<typeof formularioSchema>;
type Saida = z.output<typeof formularioSchema>;

const LINHA_VAZIA = { descricao: "", quantidade: "1", unidade: "un" as const, observacao: "" };

const CLASSE_TEXTAREA =
  "min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring";

type Props = FormularioRequisicaoDto;

// Com `cacheComponents` a página fica escondida (não desmontada) ao navegar: depois de salvar,
// o formulário é recriado para não reaparecer preenchido (mesmo cuidado de FormularioItem).
export function FormularioRequisicao(props: Props) {
  const [geracao, setGeracao] = useState(0);
  const salvoRef = useRef(false);

  useLayoutEffect(() => {
    return () => {
      if (!salvoRef.current) return;
      salvoRef.current = false;
      setGeracao((g) => g + 1);
    };
  }, []);

  return (
    <CorpoFormulario
      key={geracao}
      {...props}
      aoSalvar={() => {
        if (!props.rascunho) salvoRef.current = true;
      }}
    />
  );
}

// Requisição de compra (SPEC §6.6): UT, justificativa e as linhas (o que comprar e quanto).
// "Abrir e buscar na vitrine" abre a requisição e a IA procura itens de outras UTs para cada linha.
function CorpoFormulario({ uts, rascunho, aoSalvar }: Props & { aoSalvar: () => void }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<"rascunho" | "abrir" | null>(null);
  const escolheUt = uts.length > 1;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Valores, unknown, Saida>({
    resolver: zodResolver(formularioSchema),
    defaultValues: rascunho
      ? {
          utId: rascunho.utId,
          justificativa: rascunho.justificativa,
          linhas: rascunho.linhas.map((l) => ({ ...l, quantidade: String(l.quantidade) })),
        }
      : { utId: escolheUt ? "" : (uts[0]?.id ?? ""), justificativa: "", linhas: [LINHA_VAZIA] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "linhas" });

  function enviar(abrir: boolean) {
    return handleSubmit(async (dados) => {
      setErro(null);
      setEnviando(abrir ? "abrir" : "rascunho");
      const entrada = { ...dados, abrir };
      const resultado = rascunho ? await editarRequisicao({ ...entrada, id: rascunho.id }) : await criarRequisicao(entrada);
      setEnviando(null);
      if (!resultado.ok) {
        if (resultado.codigo?.startsWith("UT_")) setError("utId", { message: resultado.erro });
        else setErro(resultado.erro);
        return;
      }
      toast.success(abrir ? "Requisição aberta. Veja o que a vitrine tem para reuso." : "Rascunho salvo.");
      aoSalvar();
      router.push(`/requisicoes/${resultado.dados.id}`);
      router.refresh();
    });
  }

  const ocupado = enviando !== null;

  return (
    <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4 pb-20 lg:pb-0">
      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-medium">Requisição</h2>

        {escolheUt ? (
          <Campo htmlFor="req-ut" rotulo="UT requisitante" obrigatorio erro={errors.utId?.message}>
            <Seletor id="req-ut" aria-invalid={errors.utId ? true : undefined} {...register("utId")}>
              <option value="">Selecione</option>
              {uts.map((ut) => (
                <option key={ut.id} value={ut.id}>
                  {ut.rotulo}
                </option>
              ))}
            </Seletor>
          </Campo>
        ) : (
          <Campo htmlFor="req-ut" rotulo="UT requisitante" erro={errors.utId?.message}>
            <Input id="req-ut" readOnly value={uts[0]?.rotulo ?? "Sem UT vinculada"} />
          </Campo>
        )}

        <Campo
          htmlFor="req-justificativa"
          rotulo="Justificativa"
          ajuda="Opcional. Ex.: obra, contrato, manutenção programada."
          erro={errors.justificativa?.message}
        >
          <textarea
            id="req-justificativa"
            rows={2}
            maxLength={LIMITE_JUSTIFICATIVA}
            className={CLASSE_TEXTAREA}
            {...register("justificativa")}
          />
        </Campo>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium">Itens a comprar</h2>
          <span className="text-xs text-muted-foreground">
            {fields.length} de {MAXIMO_LINHAS}
          </span>
        </div>
        {errors.linhas?.root?.message || errors.linhas?.message ? (
          <p role="alert" className="text-xs text-destructive">
            {errors.linhas?.root?.message ?? errors.linhas?.message}
          </p>
        ) : null}

        <ol className="flex flex-col gap-3">
          {fields.map((field, i) => {
            const erroLinha = errors.linhas?.[i];
            return (
              <li key={field.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
                  {fields.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remover item ${i + 1}`}
                      onClick={() => remove(i)}
                      disabled={ocupado}
                    >
                      <Icone nome="delete" />
                    </Button>
                  ) : null}
                </div>

                <Campo
                  htmlFor={`req-linha-${i}-descricao`}
                  rotulo="Descrição"
                  obrigatorio
                  ajuda="O que precisa, com as especificações importantes. Ex.: Tomada 2P+T 10A branca."
                  erro={erroLinha?.descricao?.message}
                >
                  <Input
                    id={`req-linha-${i}-descricao`}
                    autoComplete="off"
                    maxLength={LIMITE_DESCRICAO_LINHA}
                    aria-invalid={erroLinha?.descricao ? true : undefined}
                    {...register(`linhas.${i}.descricao`)}
                  />
                </Campo>

                <div className="grid grid-cols-2 gap-3">
                  <Campo
                    htmlFor={`req-linha-${i}-quantidade`}
                    rotulo="Quantidade"
                    obrigatorio
                    erro={erroLinha?.quantidade?.message}
                  >
                    <Input
                      id={`req-linha-${i}-quantidade`}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={erroLinha?.quantidade ? true : undefined}
                      {...register(`linhas.${i}.quantidade`)}
                    />
                  </Campo>
                  <Campo htmlFor={`req-linha-${i}-unidade`} rotulo="Unidade" obrigatorio erro={erroLinha?.unidade?.message}>
                    <Seletor id={`req-linha-${i}-unidade`} {...register(`linhas.${i}.unidade`)}>
                      {UNIDADES.map((u) => (
                        <option key={u} value={u}>
                          {ROTULO_UNIDADE[u]}
                        </option>
                      ))}
                    </Seletor>
                  </Campo>
                </div>

                <Campo
                  htmlFor={`req-linha-${i}-observacao`}
                  rotulo="Observação"
                  ajuda="Opcional. Ex.: aceita usado, precisa ser da marca X."
                  erro={erroLinha?.observacao?.message}
                >
                  <Input
                    id={`req-linha-${i}-observacao`}
                    autoComplete="off"
                    maxLength={LIMITE_OBSERVACAO_LINHA}
                    {...register(`linhas.${i}.observacao`)}
                  />
                </Campo>
              </li>
            );
          })}
        </ol>

        {fields.length < MAXIMO_LINHAS ? (
          <Button type="button" variant="secondary" onClick={() => append(LINHA_VAZIA)} disabled={ocupado}>
            <Icone nome="add" />
            Adicionar item
          </Button>
        ) : null}
      </section>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={enviar(false)} disabled={ocupado}>
          {enviando === "rascunho" ? "Salvando…" : "Salvar rascunho"}
        </Button>
        <Button type="button" onClick={enviar(true)} disabled={ocupado}>
          {enviando === "abrir" ? "Buscando na vitrine…" : "Abrir e buscar na vitrine"}
        </Button>
      </div>
      {enviando === "abrir" ? (
        <p className="text-right text-xs text-muted-foreground">
          A IA está procurando itens de outras UTs. Isso pode levar até um minuto.
        </p>
      ) : null}
    </form>
  );
}
