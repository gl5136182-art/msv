"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { decimalParaCampo, mascararMoeda, moedaParaCampo } from "@/lib/numeros-ptbr";
import { criarItem, editarItem } from "@/modules/itens/itens.actions";
import {
  ESTADOS,
  ROTULO_ESTADO,
  ROTULO_UNIDADE,
  UNIDADES,
  itemSchema,
  type ItemEntrada,
  type ItemParaEdicaoDto,
  type ItemFormulario as ItemFormularioValores,
} from "@/modules/itens/itens.schemas";

import { CampoFotos, type FotoFormulario } from "./campo-fotos";

type FormularioItemProps = {
  categorias: Array<{ id: string; nome: string }>;
  /** Item em edição; sem ele o formulário cadastra um novo. */
  item?: ItemParaEdicaoDto;
};

const MENSAGEM_FOTOS_PENDENTES = "Aguarde o envio das fotos ou remova as que falharam.";

// Cadastro de item (SPEC §6.1), pensado para o celular dentro do almoxarifado: se o upload ou
// o salvamento falhar, nada do que foi preenchido é perdido (a tela não é recarregada e as
// fotos já enviadas continuam na lista).
export function FormularioItem({ categorias, item }: FormularioItemProps) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [fotosPendentes, setFotosPendentes] = useState(false);

  const fotosIniciais = useMemo<FotoFormulario[]>(
    () =>
      (item?.fotos ?? []).map((foto) => ({
        id: foto.chave,
        situacao: "enviada",
        progresso: 100,
        previa: item?.previas[foto.chaveThumb] ?? null,
        chave: foto.chave,
        chaveThumb: foto.chaveThumb,
        erro: null,
      })),
    [item],
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<ItemFormularioValores, unknown, ItemEntrada>({
    resolver: zodResolver(itemSchema),
    // Na edição a quantidade não é alterada aqui (SPEC §3, regras 2 e 3): o campo fica oculto e
    // o valor segue preenchido só para passar na validação (o servidor o ignora).
    defaultValues: item
      ? {
          nome: item.nome,
          categoriaId: item.categoria.id,
          marca: item.marca,
          modelo: item.modelo,
          descricao: item.descricao ?? "",
          estado: item.estado,
          unidade: item.unidade,
          quantidade: item.quantidadeTotal,
          valorUnitarioReposicao: moedaParaCampo(item.valorUnitarioReposicao),
          larguraCm: decimalParaCampo(item.larguraCm),
          alturaCm: decimalParaCampo(item.alturaCm),
          profundidadeCm: decimalParaCampo(item.profundidadeCm),
          pesoKg: decimalParaCampo(item.pesoKg),
          fotos: item.fotos.map(({ chave, chaveThumb }) => ({ chave, chaveThumb })),
        }
      : {
          nome: "",
          categoriaId: "",
          marca: "",
          modelo: "",
          descricao: "",
          estado: undefined,
          unidade: "un",
          quantidade: "",
          valorUnitarioReposicao: "",
          larguraCm: "",
          alturaCm: "",
          profundidadeCm: "",
          pesoKg: "",
          fotos: [],
        },
  });

  const aoMudarFotos = useCallback(
    (fotos: FotoFormulario[]) => {
      const prontas = fotos
        .filter((f) => f.situacao === "enviada" && f.chave && f.chaveThumb)
        .map((f) => ({ chave: f.chave as string, chaveThumb: f.chaveThumb as string }));
      setFotosPendentes(fotos.some((f) => f.situacao !== "enviada"));
      setValue("fotos", prontas, { shouldValidate: isSubmitted });
    },
    [setValue, isSubmitted],
  );

  async function aoEnviar(dados: ItemEntrada) {
    setErro(null);
    const resultado = item ? await editarItem({ ...dados, id: item.id }) : await criarItem(dados);
    if (!resultado.ok) {
      // Mantém tudo na tela: o usuário só toca em "Salvar" de novo.
      setErro(resultado.erro);
      return;
    }
    toast.success("Item salvo.");
    router.push("/meus-itens");
    router.refresh();
  }

  const erroFotos = errors.fotos?.message ?? errors.fotos?.root?.message;

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        if (fotosPendentes) {
          evento.preventDefault();
          setErro(MENSAGEM_FOTOS_PENDENTES);
          return;
        }
        void handleSubmit(aoEnviar)(evento);
      }}
      className="flex flex-col gap-4 pb-20 lg:pb-0"
    >
      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-medium">Fotos</h2>
        <CampoFotos
          fotosIniciais={fotosIniciais}
          aoMudar={aoMudarFotos}
          erro={erroFotos}
          desabilitado={isSubmitting}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-medium">Identificação</h2>

        <Campo htmlFor="item-nome" rotulo="Nome do item" obrigatorio erro={errors.nome?.message}>
          <Input
            id="item-nome"
            autoComplete="off"
            maxLength={150}
            aria-invalid={errors.nome ? true : undefined}
            {...register("nome")}
          />
        </Campo>

        <Campo htmlFor="item-categoria" rotulo="Categoria" obrigatorio erro={errors.categoriaId?.message}>
          <Seletor
            id="item-categoria"
            aria-invalid={errors.categoriaId ? true : undefined}
            {...register("categoriaId")}
          >
            <option value="">Selecione</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </Seletor>
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo htmlFor="item-marca" rotulo="Marca" obrigatorio erro={errors.marca?.message}>
            <Input
              id="item-marca"
              autoComplete="off"
              maxLength={100}
              aria-invalid={errors.marca ? true : undefined}
              {...register("marca")}
            />
          </Campo>
          <Campo htmlFor="item-modelo" rotulo="Modelo" obrigatorio erro={errors.modelo?.message}>
            <Input
              id="item-modelo"
              autoComplete="off"
              maxLength={100}
              aria-invalid={errors.modelo ? true : undefined}
              {...register("modelo")}
            />
          </Campo>
        </div>

        <Campo htmlFor="item-estado" rotulo="Condição" obrigatorio erro={errors.estado?.message}>
          <Seletor id="item-estado" aria-invalid={errors.estado ? true : undefined} {...register("estado")}>
            <option value="">Selecione</option>
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {ROTULO_ESTADO[estado]}
              </option>
            ))}
          </Seletor>
        </Campo>

        <Campo
          htmlFor="item-descricao"
          rotulo="Descrição"
          ajuda="Opcional. Detalhes que ajudem a outra UT a decidir."
          erro={errors.descricao?.message}
        >
          <textarea
            id="item-descricao"
            rows={3}
            maxLength={1000}
            aria-invalid={errors.descricao ? true : undefined}
            className="min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors duration-150 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring aria-invalid:border-destructive"
            {...register("descricao")}
          />
        </Campo>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <h2 className="text-base font-medium">Quantidade e valor</h2>

        <div className="grid grid-cols-2 gap-3">
          {item ? null : (
            <Campo htmlFor="item-quantidade" rotulo="Quantidade" obrigatorio erro={errors.quantidade?.message}>
              <Input
                id="item-quantidade"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={errors.quantidade ? true : undefined}
                {...register("quantidade")}
              />
            </Campo>
          )}
          <Campo htmlFor="item-unidade" rotulo="Unidade" obrigatorio erro={errors.unidade?.message}>
            <Seletor id="item-unidade" aria-invalid={errors.unidade ? true : undefined} {...register("unidade")}>
              {UNIDADES.map((unidade) => (
                <option key={unidade} value={unidade}>
                  {ROTULO_UNIDADE[unidade]}
                </option>
              ))}
            </Seletor>
          </Campo>
        </div>

        <Controller
          control={control}
          name="valorUnitarioReposicao"
          render={({ field, fieldState }) => (
            <Campo
              htmlFor="item-valor"
              rotulo="Valor unitário de reposição"
              obrigatorio
              ajuda="Quanto custaria comprar um item novo igual a este."
              erro={fieldState.error?.message}
            >
              <Input
                id="item-valor"
                inputMode="numeric"
                autoComplete="off"
                placeholder="R$ 0,00"
                aria-invalid={fieldState.error ? true : undefined}
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                value={typeof field.value === "number" ? moedaParaCampo(field.value) : (field.value ?? "")}
                onChange={(e) => field.onChange(mascararMoeda(e.target.value))}
              />
            </Campo>
          )}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Dimensões e peso</h2>
            <p className="text-xs text-muted-foreground">Meça o item ou peça uma recomendação da IA.</p>
          </div>
          {/* Fica desabilitado até a recomendação da IA existir (Fase 5). */}
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button type="button" variant="secondary" size="sm" disabled>
              Recomendar com IA
            </Button>
            <p className="text-xs text-muted-foreground">Preencha foto, nome, marca e modelo</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo htmlFor="item-largura" rotulo="Largura (cm)" obrigatorio erro={errors.larguraCm?.message}>
            <Input
              id="item-largura"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={errors.larguraCm ? true : undefined}
              {...register("larguraCm")}
            />
          </Campo>
          <Campo htmlFor="item-altura" rotulo="Altura (cm)" obrigatorio erro={errors.alturaCm?.message}>
            <Input
              id="item-altura"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={errors.alturaCm ? true : undefined}
              {...register("alturaCm")}
            />
          </Campo>
          <Campo
            htmlFor="item-profundidade"
            rotulo="Profundidade (cm)"
            obrigatorio
            erro={errors.profundidadeCm?.message}
          >
            <Input
              id="item-profundidade"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={errors.profundidadeCm ? true : undefined}
              {...register("profundidadeCm")}
            />
          </Campo>
          <Campo htmlFor="item-peso" rotulo="Peso (kg)" obrigatorio erro={errors.pesoKg?.message}>
            <Input
              id="item-peso"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={errors.pesoKg ? true : undefined}
              {...register("pesoKg")}
            />
          </Campo>
        </div>
      </section>

      {erro ? (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      {/* Mobile: barra fixa logo acima da navegação inferior (DESIGN §5). */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-card p-3 lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0">
        <div className="flex gap-2 lg:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="hidden lg:inline-flex"
            disabled={isSubmitting}
            onClick={() => router.push("/meus-itens")}
          >
            Cancelar
          </Button>
          <Button type="submit" className="w-full lg:w-auto" disabled={isSubmitting}>
            {isSubmitting ? "Salvando…" : item ? "Salvar alterações" : "Salvar item"}
          </Button>
        </div>
      </div>
    </form>
  );
}
