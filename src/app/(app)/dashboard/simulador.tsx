"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatarMoeda, formatarMoedaResumida } from "@/lib/formatacao";
import { lerMoeda, mascararMoeda, moedaParaCampo } from "@/lib/numeros-ptbr";
import { simular } from "@/modules/dashboard/dashboard.regras";
import type { SimuladorBaseDto } from "@/modules/dashboard/dashboard.schemas";

const PERCENTUAL_PADRAO = 30;

// Simulador (SPEC §6.5, DESIGN §7 item 7): slider e frete à esquerda, as duas projeções à direita.
// Recalcula a cada movimento, sem botão. O pai usa `key` para recomeçar quando os filtros mudam.
export function Simulador({ base }: { base: SimuladorBaseDto }) {
  const idPercentual = useId();
  const idFrete = useId();
  const [percentual, setPercentual] = useState(PERCENTUAL_PADRAO);
  const [freteTexto, setFreteTexto] = useState(() => moedaParaCampo(base.freteMedioPadrao));

  const freteLido = lerMoeda(freteTexto);
  const frete = Number.isNaN(freteLido) ? 0 : freteLido;

  const projecao = simular({
    valorParado: base.valorParado,
    itensDisponiveis: base.itensDisponiveis,
    valorCadastrado90d: base.valorCadastrado90d,
    itensCadastrados90d: base.itensCadastrados90d,
    percentual,
    freteMedio: frete,
  });

  return (
    <section className="flex flex-col gap-3 rounded-md bg-card p-2.5" aria-label="Simulação">
      <h2 className="text-[13px] font-medium">Simulação: não é valor realizado</h2>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center lg:gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idPercentual} className="flex justify-between text-xs font-medium">
              <span>% do valor ocioso que seria reaproveitado</span>
              <span className="font-numeros text-sm">{percentual}%</span>
            </label>
            <input
              id={idPercentual}
              type="range"
              min={0}
              max={100}
              step={1}
              value={percentual}
              onChange={(evento) => setPercentual(Number(evento.target.value))}
              className="h-11 w-full accent-primary lg:h-6"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={idFrete} className="text-xs font-medium">
              Frete médio por transferência
            </label>
            <Input
              id={idFrete}
              inputMode="numeric"
              autoComplete="off"
              value={freteTexto}
              onChange={(evento) => setFreteTexto(mascararMoeda(evento.target.value))}
            />
            <p className="text-xs font-light text-muted-foreground">
              Padrão: R$ 150,00 por transferência. Ajuste se o seu frete habitual for outro.
            </p>
          </div>
        </div>

        <ul className="grid gap-2 md:grid-cols-2">
          <li className="flex flex-col gap-1 rounded-md border border-border p-3">
            <p className="font-numeros text-[28px] leading-tight text-primary lg:text-[32px]">
              {formatarMoedaResumida(projecao.imediata)}
            </p>
            <p className="text-xs font-medium">Projeção imediata</p>
            <p className="text-xs font-light text-muted-foreground">
              {formatarMoeda(projecao.imediata)}: compra evitada se {percentual}% do estoque parado de hoje
              fosse reaproveitado, já descontado o frete.
            </p>
          </li>
          <li className="flex flex-col gap-1 rounded-md border border-border p-3">
            <p className="font-numeros text-[28px] leading-tight text-primary lg:text-[32px]">
              {formatarMoedaResumida(projecao.anual)}
            </p>
            <p className="text-xs font-medium">Projeção anual</p>
            <p className="text-xs font-light text-muted-foreground">
              {formatarMoeda(projecao.anual)}: compra evitada em 12 meses, se o ritmo de cadastro dos últimos
              90 dias continuar e {percentual}% fosse reaproveitado, já descontado o frete.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
}
