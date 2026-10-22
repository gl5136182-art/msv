"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { TagIa } from "@/components/ui/tag-ia";
import { formatarMoeda, formatarNumero } from "@/lib/formatacao";
import { estimarFrete } from "@/modules/itens/itens.actions";
import { ROTULO_UNIDADE, type EstimativaFreteDto, type Unidade } from "@/modules/itens/itens.schemas";

type BotaoCalcularFreteProps = {
  itemId: string;
  nome: string;
  quantidadeDisponivel: number;
  unidade: Unidade;
  /** UTs do usuário que podem receber o item, a principal primeiro (pelo menos uma). */
  utsDestino: Array<{ id: string; rotulo: string }>;
};

// Modal "Calcular frete" (SPEC §6.6): mesma UT de destino e quantidade do "Solicitar"; a IA
// estima transportadora e veículo próprio pela cidade/UF das UTs, e a compra nova vem do valor de
// reposição. A opção mais barata ganha a tag. É estimativa: a tela diz isso.
export function BotaoCalcularFrete({ itemId, nome, quantidadeDisponivel, unidade, utsDestino }: BotaoCalcularFreteProps) {
  const escolheDestino = utsDestino.length > 1;
  const destinoUnico = escolheDestino ? "" : (utsDestino[0]?.id ?? "");
  const [aberto, setAberto] = useState(false);
  const [utDestinoId, setUtDestinoId] = useState(destinoUnico);
  const [erroUt, setErroUt] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState<string | null>(null);
  const [estimativa, setEstimativa] = useState<EstimativaFreteDto | null>(null);
  const [processando, iniciar] = useTransition();

  const rotuloUnidade = ROTULO_UNIDADE[unidade].toLowerCase();

  function aoMudar(proximo: boolean) {
    if (processando) return;
    setAberto(proximo);
    if (proximo) {
      setUtDestinoId(destinoUnico);
      setQuantidade("1");
      setErro(null);
      setErroUt(null);
      setEstimativa(null);
    }
  }

  function aoCalcular(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setErroUt(null);

    if (!utDestinoId) {
      setErroUt("Selecione a UT de destino.");
      return;
    }
    const valor = Number(quantidade);
    if (!Number.isInteger(valor) || valor < 1) {
      setErro("Informe a quantidade.");
      return;
    }
    if (valor > quantidadeDisponivel) {
      setErro(`A quantidade máxima é ${formatarNumero(quantidadeDisponivel)}.`);
      return;
    }

    iniciar(async () => {
      setEstimativa(null);
      const resultado = await estimarFrete({ itemId, utDestinoId, quantidade: valor });
      if (!resultado.ok) {
        if (resultado.codigo?.startsWith("UT_DESTINO")) setErroUt(resultado.erro);
        else setErro(resultado.erro);
        return;
      }
      setEstimativa(resultado.dados);
    });
  }

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => aoMudar(true)}>
        Calcular frete
      </Button>

      <Dialogo
        aberto={aberto}
        aoMudar={aoMudar}
        titulo="Calcular frete"
        descricao={nome}
        rodape={
          <>
            <Button variant="secondary" onClick={() => aoMudar(false)} disabled={processando}>
              Fechar
            </Button>
            <Button type="submit" form="form-calcular-frete" disabled={processando}>
              {processando ? "Calculando…" : estimativa ? "Calcular de novo" : "Calcular"}
            </Button>
          </>
        }
      >
        <form id="form-calcular-frete" onSubmit={aoCalcular} noValidate className="flex flex-col gap-4">
          {escolheDestino ? (
            <Campo
              htmlFor="frete-ut-destino"
              rotulo="UT Destino"
              obrigatorio
              ajuda="Para qual das suas UTs o item iria."
              erro={erroUt ?? undefined}
            >
              <Seletor
                id="frete-ut-destino"
                value={utDestinoId}
                onChange={(e) => {
                  setUtDestinoId(e.target.value);
                  setEstimativa(null);
                }}
                aria-invalid={erroUt ? true : undefined}
              >
                <option value="">Selecione</option>
                {utsDestino.map((ut) => (
                  <option key={ut.id} value={ut.id}>
                    {ut.rotulo}
                  </option>
                ))}
              </Seletor>
            </Campo>
          ) : (
            <Campo htmlFor="frete-ut-destino" rotulo="UT Destino" erro={erroUt ?? undefined}>
              <Input id="frete-ut-destino" readOnly value={utsDestino[0]?.rotulo ?? ""} />
            </Campo>
          )}

          <Campo
            htmlFor="frete-quantidade"
            rotulo="Quantidade"
            obrigatorio
            ajuda={`Disponível: ${formatarNumero(quantidadeDisponivel)} ${rotuloUnidade}.`}
            erro={erro ?? undefined}
          >
            <Input
              id="frete-quantidade"
              inputMode="numeric"
              autoComplete="off"
              value={quantidade}
              onChange={(e) => {
                setQuantidade(e.target.value.replace(/\D/g, ""));
                setEstimativa(null);
              }}
              aria-invalid={erro ? true : undefined}
            />
          </Campo>
        </form>

        {processando ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            A IA está estimando o frete. Isso pode levar alguns segundos…
          </p>
        ) : null}

        {estimativa ? <ResultadoFrete estimativa={estimativa} rotuloUnidade={rotuloUnidade} /> : null}
      </Dialogo>
    </>
  );
}

function ResultadoFrete({ estimativa, rotuloUnidade }: { estimativa: EstimativaFreteDto; rotuloUnidade: string }) {
  const { quantidade, carga } = estimativa;
  const qtd = `${formatarNumero(quantidade)} ${rotuloUnidade}`;
  const faixa = (f: { min: number; max: number }) =>
    f.min === f.max ? formatarMoeda(f.min) : `${formatarMoeda(f.min)} a ${formatarMoeda(f.max)}`;

  const linhas = [
    {
      chave: "compra",
      opcao: `Comprar ${qtd} novas (${formatarMoeda(estimativa.valorUnitarioReposicao)} cada)`,
      valor: formatarMoeda(estimativa.compraNova),
    },
    { chave: "transportadora", opcao: `Transferir ${qtd} por transportadora`, valor: faixa(estimativa.transportadora) },
    { chave: "veiculo", opcao: "Buscar com veículo próprio", valor: faixa(estimativa.veiculoProprio) },
  ] as const;

  const medidas = [
    carga.pesoTotalKg !== null ? `${formatarNumero(carga.pesoTotalKg, 0, 2)} kg` : null,
    carga.volumeTotalM3 !== null ? `${formatarNumero(carga.volumeTotalM3, 0, 3)} m³` : null,
  ].filter(Boolean);

  return (
    <section aria-label="Estimativa de frete" className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Trajeto</dt>
        <dd>
          {estimativa.origem} → {estimativa.destino} (~{formatarNumero(estimativa.distanciaKm)} km)
        </dd>
        <dt className="text-muted-foreground">Carga</dt>
        <dd>{carga.medidasInformadas && medidas.length > 0 ? medidas.join(" · ") : "Estimada pela IA (item sem medidas)"}</dd>
      </dl>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Opção</th>
              <th className="px-3 py-2 font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const recomendada = linha.chave === estimativa.recomendada;
              return (
                <tr key={linha.chave} className={`border-t border-border ${recomendada ? "bg-laranja-25/40" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      {linha.opcao}
                      {recomendada ? <TagIa>Mais barato</TagIa> : null}
                    </span>
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap ${recomendada ? "font-medium" : ""}`}>{linha.valor}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {estimativa.justificativa ? <p className="text-sm">{estimativa.justificativa}</p> : null}
      <p className="text-xs text-muted-foreground">
        Estimativa gerada por IA a partir da cidade/UF das UTs; os valores reais podem variar.
      </p>
    </section>
  );
}
