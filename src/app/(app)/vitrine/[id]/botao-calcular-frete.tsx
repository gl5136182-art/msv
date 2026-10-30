"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { Selo } from "@/components/ui/selo";
import { TagIa } from "@/components/ui/tag-ia";
import { formatarDataHora, formatarMoeda, formatarNumero } from "@/lib/formatacao";
import { cotarFrete } from "@/modules/itens/itens.actions";
import { ROTULO_UNIDADE, type CotacaoFreteDto, type Unidade } from "@/modules/itens/itens.schemas";

type BotaoCalcularFreteProps = {
  itemId: string;
  nome: string;
  quantidadeDisponivel: number;
  unidade: Unidade;
  /** UTs do usuário que podem receber o item, a principal primeiro (pelo menos uma). */
  utsDestino: Array<{ id: string; rotulo: string }>;
};

export function BotaoCalcularFrete({ itemId, nome, quantidadeDisponivel, unidade, utsDestino }: BotaoCalcularFreteProps) {
  const escolheDestino = utsDestino.length > 1;
  const destinoUnico = escolheDestino ? "" : (utsDestino[0]?.id ?? "");
  const [aberto, setAberto] = useState(false);
  const [utDestinoId, setUtDestinoId] = useState(destinoUnico);
  const [erroUt, setErroUt] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CotacaoFreteDto | null>(null);
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
      setResultado(null);
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
      setResultado(null);
      const resposta = await cotarFrete({ itemId, utDestinoId, quantidade: valor });
      if (!resposta.ok) {
        if (resposta.codigo?.startsWith("UT_DESTINO") || resposta.codigo === "CEP_DESTINO_AUSENTE") {
          setErroUt(resposta.erro);
        } else {
          setErro(resposta.erro);
        }
        return;
      }
      setResultado(resposta.dados);
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
        className="sm:max-w-3xl"
        rodape={
          <>
            <Button variant="secondary" onClick={() => aoMudar(false)} disabled={processando}>
              Fechar
            </Button>
            <Button type="submit" form="form-calcular-frete" disabled={processando}>
              {processando ? "Calculando…" : resultado ? "Calcular de novo" : "Calcular"}
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
                  setResultado(null);
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
                setResultado(null);
              }}
              aria-invalid={erro ? true : undefined}
            />
          </Campo>
        </form>

        {processando ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            Consultando transportadoras e comparando opções. Isso pode levar alguns segundos…
          </p>
        ) : null}

        {resultado ? <ResultadoFrete resultado={resultado} rotuloUnidade={rotuloUnidade} /> : null}
      </Dialogo>
    </>
  );
}

function ResultadoFrete({ resultado, rotuloUnidade }: { resultado: CotacaoFreteDto; rotuloUnidade: string }) {
  const { quantidade, carga, recomendacao } = resultado;
  const qtd = `${formatarNumero(quantidade)} ${rotuloUnidade}`;
  const faixa = (valor: { min: number; max: number }) =>
    valor.min === valor.max ? formatarMoeda(valor.min) : `${formatarMoeda(valor.min)} a ${formatarMoeda(valor.max)}`;
  const prazo = (dias: number | null) => (dias === null ? "—" : `${dias} ${dias === 1 ? "dia útil" : "dias úteis"}`);

  const linhas = resultado.cotacoes.map((cotacao) => ({
    chave: `cotacao-${cotacao.id}`,
    opcao: `Transferir ${qtd} · ${cotacao.transportadora} ${cotacao.servico}`,
    valor: formatarMoeda(cotacao.valor),
    prazo: prazo(cotacao.prazoDias),
  }));
  if (resultado.veiculoProprio) {
    linhas.push({
      chave: "veiculo",
      opcao: "Buscar com veículo próprio (estimativa)",
      valor: faixa(resultado.veiculoProprio),
      prazo: "—",
    });
  }
  linhas.push({
    chave: "compra",
    opcao: `Comprar ${qtd} novas (${formatarMoeda(resultado.valorUnitarioReposicao)} cada)`,
    valor: formatarMoeda(resultado.compraNova),
    prazo: "—",
  });

  return (
    <section aria-label="Cotação de frete" className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Trajeto</dt>
        <dd>
          {resultado.origem} → {resultado.destino}
          {resultado.distanciaKm !== null ? ` (~${formatarNumero(resultado.distanciaKm)} km)` : ""}
        </dd>
        <dt className="text-muted-foreground">Carga</dt>
        <dd>
          {formatarNumero(carga.pesoTotalKg, 0, 2)} kg · {formatarNumero(carga.volumeTotalM3, 0, 3)} m³
        </dd>
        <dt className="text-muted-foreground">Cotado em</dt>
        <dd>{formatarDataHora(resultado.cotadoEm)}</dd>
      </dl>

      {resultado.cotacoes.length === 0 ? (
        <p role="status" className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          Nenhuma transportadora atendeu a esta carga e trajeto. Compare as demais opções ou cadastre medidas diferentes
          somente se elas representarem a embalagem real.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-lg text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Opção</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const recomendada =
                recomendacao.tipo === "cotacao"
                  ? linha.chave === `cotacao-${recomendacao.cotacaoId}`
                  : linha.chave === recomendacao.tipo;
              return (
                <tr key={linha.chave} className={`border-t border-border ${recomendada ? "bg-laranja-25/40" : ""}`}>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap items-center gap-1">
                      {linha.opcao}
                      {recomendada && recomendacao.origem === "ia" ? <TagIa>Recomendado pela IA</TagIa> : null}
                      {recomendada && recomendacao.origem === "menor_custo" ? (
                        <Selo variante="contorno">Menor custo</Selo>
                      ) : null}
                    </span>
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap ${recomendada ? "font-medium" : ""}`}>{linha.valor}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{linha.prazo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Fretes cotados na SuperFrete, sujeitos à disponibilidade e à conferência da transportadora. Veículo próprio e
        distância são estimativas da IA. Nenhum envio foi contratado.
      </p>
    </section>
  );
}
