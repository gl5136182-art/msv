"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatarMoeda, formatarMoedaResumida } from "@/lib/formatacao";
import type { BarraDto } from "@/modules/dashboard/dashboard.schemas";

import { CartaoGrafico } from "./cartao-grafico";
import { COR_EIXO, COR_GRADE, COR_SERIE_1 } from "./cores";

// Os gráficos do §6.5 (DESIGN §7): barras finas com topo arredondado de 4px, grade #e2e2e2,
// eixos em maiúsculas, tooltip branco com borda. Uma medida por gráfico, num eixo só.

const LARGURA_ROTULO_UT = 150;
/** Caracteres do nome da UT que cabem na primeira linha do rótulo do eixo. */
const MAXIMO_CARACTERES_NOME = 20;
const ALTURA_LINHA_BARRA = 38;

const textoEixo = { fontSize: 11, fontWeight: 300, fill: COR_EIXO } as const;

/** Separa "Nome da UT · Cidade/UF" nas duas linhas do rótulo do eixo; o nome longo é cortado. */
export function dividirRotulo(rotulo: string, maximo = MAXIMO_CARACTERES_NOME): { nome: string; local: string } {
  const separador = rotulo.lastIndexOf(" · ");
  const nome = separador === -1 ? rotulo : rotulo.slice(0, separador);
  const local = separador === -1 ? "" : rotulo.slice(separador + 3);
  return { nome: nome.length > maximo ? `${nome.slice(0, maximo - 1)}…` : nome, local };
}

type DicaProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string | number; value?: number | string; color?: string }>;
  label?: string | number;
};

/** Tooltip simples (DESIGN §7): fundo branco, borda #e2e2e2, valores em pt-BR. */
function Dica({ active, payload, label }: DicaProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="max-w-64 rounded-md border border-border bg-card px-2.5 py-2 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <p className="mb-1 font-medium">{label}</p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((linha) => (
          <li key={String(linha.name)} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: linha.color }} />
            <span className="font-light">{linha.name}:</span>
            <span className="font-medium">{formatarMoeda(Number(linha.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TickRotuloProps = { x?: number | string; y?: number | string; payload?: { value?: string | number } };

function TickRotuloUt({ x = 0, y = 0, payload }: TickRotuloProps) {
  const completo = String(payload?.value ?? "");
  const { nome, local } = dividirRotulo(completo);
  return (
    <text x={Number(x)} y={Number(y)} textAnchor="end" style={textoEixo}>
      <title>{completo}</title>
      <tspan x={Number(x)} dy={local ? -2 : 4}>
        {nome.toUpperCase()}
      </tspan>
      {local ? (
        <tspan x={Number(x)} dy={13}>
          {local.toUpperCase()}
        </tspan>
      ) : null}
    </text>
  );
}

// ---------------------------------------------------------------------------------------

/** Barras horizontais de uma série (valor parado por UT): rótulos longos pedem barras deitadas. */
export function GraficoValorParadoPorUt({ barras }: { barras: BarraDto[] }) {
  const altura = Math.max(barras.length, 1) * ALTURA_LINHA_BARRA + 32;

  return (
    <CartaoGrafico
      titulo="Valor ocioso por UT (top 10)"
      tabela={{
        colunas: ["UT", "Valor ocioso"],
        linhas: barras.map((b) => [b.rotulo, formatarMoeda(b.valor)]),
      }}
    >
      <div className="w-full" style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barras} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={6}>
            <CartesianGrid stroke={COR_GRADE} horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatarMoedaResumida(v)}
              tick={textoEixo}
              tickLine={false}
              axisLine={{ stroke: COR_GRADE }}
            />
            <YAxis
              type="category"
              dataKey="rotulo"
              width={LARGURA_ROTULO_UT}
              tick={<TickRotuloUt />}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <Tooltip content={<Dica />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar
              dataKey="valor"
              name="Valor ocioso"
              fill={COR_SERIE_1}
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CartaoGrafico>
  );
}

// ---------------------------------------------------------------------------------------

export function GraficoValorParadoPorCategoria({ barras }: { barras: BarraDto[] }) {
  return (
    <CartaoGrafico
      titulo="Valor ocioso por categoria"
      tabela={{
        colunas: ["Categoria", "Valor ocioso"],
        linhas: barras.map((b) => [b.rotulo, formatarMoeda(b.valor)]),
      }}
    >
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barras} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={COR_GRADE} vertical={false} />
            <XAxis
              dataKey="rotulo"
              tickFormatter={(v: string) => v.toUpperCase()}
              tick={textoEixo}
              tickLine={false}
              axisLine={{ stroke: COR_GRADE }}
            />
            <YAxis
              tickFormatter={(v: number) => formatarMoedaResumida(v)}
              tick={textoEixo}
              tickLine={false}
              axisLine={false}
              width={78}
            />
            <Tooltip content={<Dica />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Bar
              dataKey="valor"
              name="Valor ocioso"
              fill={COR_SERIE_1}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </CartaoGrafico>
  );
}
