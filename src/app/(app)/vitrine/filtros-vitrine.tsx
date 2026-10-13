"use client";

import Form from "next/form";
import Link from "next/link";

import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { Seletor } from "@/components/ui/seletor";
import { rotuloUt } from "@/lib/rotulo-ut";
import {
  CATEGORIAS_ITEM,
  ESTADOS,
  ORDENACOES_VITRINE,
  ROTULO_CATEGORIA,
  ROTULO_ESTADO,
  ROTULO_ORDENACAO_VITRINE,
  ROTULO_SEGMENTO,
  SEGMENTOS,
  type FiltrosVitrine,
} from "@/modules/itens/itens.schemas";

type Props = {
  filtros: FiltrosVitrine;
  uts: Array<{ id: string; nome: string; cidade: string; uf: string }>;
  ufs: string[];
  comFiltros: boolean;
};

// Busca e filtros da vitrine (SPEC §6.3). É um formulário GET: os valores vão para a URL e a
// página (servidor) lê de lá. Trocar um select envia na hora; o texto envia no botão/Enter.
// O pai usa `key` para recriar o formulário quando a URL muda (os campos não controlados
// precisam voltar aos valores da URL, por exemplo após "Limpar filtros").
export function FiltrosVitrineForm({ filtros, uts, ufs, comFiltros }: Props) {
  return (
    <Form
      action="/vitrine"
      role="search"
      className="mb-4 flex flex-col gap-3 rounded-md border border-border bg-card p-3 lg:mb-6"
      onChange={(evento) => {
        if (evento.target instanceof HTMLSelectElement) evento.currentTarget.requestSubmit();
      }}
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="vitrine-busca" className="sr-only">
            Buscar itens
          </label>
          <Icone
            nome="search"
            tamanho={20}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="vitrine-busca"
            type="search"
            name="q"
            defaultValue={filtros.busca ?? ""}
            placeholder="Buscar por nome, marca, modelo ou categoria"
            autoComplete="off"
            maxLength={100}
            className="pl-10"
          />
        </div>
        <Button type="submit">Buscar</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Campo htmlFor="vitrine-categoria" rotulo="Categoria">
          <Seletor id="vitrine-categoria" name="categoria" defaultValue={filtros.categoria ?? ""}>
            <option value="">Todas</option>
            {CATEGORIAS_ITEM.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </Seletor>
        </Campo>

        <Campo htmlFor="vitrine-segmento" rotulo="Segmento">
          <Seletor id="vitrine-segmento" name="segmento" defaultValue={filtros.segmento ?? ""}>
            <option value="">Todos</option>
            {SEGMENTOS.map((s) => (
              <option key={s} value={s}>
                {ROTULO_SEGMENTO[s]}
              </option>
            ))}
          </Seletor>
        </Campo>

        <Campo htmlFor="vitrine-condicao" rotulo="Condição">
          <Seletor id="vitrine-condicao" name="condicao" defaultValue={filtros.estado ?? ""}>
            <option value="">Todas</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ROTULO_ESTADO[e]}
              </option>
            ))}
          </Seletor>
        </Campo>

        <Campo htmlFor="vitrine-uf" rotulo="UF">
          <Seletor id="vitrine-uf" name="uf" defaultValue={filtros.uf ?? ""}>
            <option value="">Todas</option>
            {ufs.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Seletor>
        </Campo>

        <Campo htmlFor="vitrine-ut" rotulo="UT">
          <Seletor id="vitrine-ut" name="ut" defaultValue={filtros.utId ?? ""}>
            <option value="">Todas</option>
            {uts.map((ut) => (
              <option key={ut.id} value={ut.id}>
                {rotuloUt(ut)}
              </option>
            ))}
          </Seletor>
        </Campo>

        <Campo htmlFor="vitrine-ordem" rotulo="Ordenar por">
          <Seletor id="vitrine-ordem" name="ordem" defaultValue={filtros.ordenar}>
            {ORDENACOES_VITRINE.map((o) => (
              <option key={o} value={o}>
                {ROTULO_ORDENACAO_VITRINE[o]}
              </option>
            ))}
          </Seletor>
        </Campo>
      </div>

      {comFiltros ? (
        <div>
          <Button asChild variant="link">
            <Link href="/vitrine">Limpar filtros</Link>
          </Button>
        </div>
      ) : null}
    </Form>
  );
}
