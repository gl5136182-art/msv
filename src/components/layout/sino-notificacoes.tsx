"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useState } from "react";

import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { formatarDataRelativa } from "@/lib/formatacao";
import {
  listarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
} from "@/modules/notificacoes/notificacoes.actions";
import type { ListaNotificacoesDto, NotificacaoDto } from "@/modules/notificacoes/notificacoes.schemas";

/** Atualização por polling simples, sem realtime (SPEC §6.4). */
const INTERVALO_MS = 60_000;

// Sino da barra superior (DESIGN §6, Notificações): contador de não lidas e lista suspensa.
// No mobile a lista ocupa a tela toda; no desktop abre como painel sob o sino. Atualiza ao
// navegar, ao abrir e a cada 60s (só com a aba visível).
export function SinoNotificacoes() {
  const pathname = usePathname();
  const [lista, setLista] = useState<ListaNotificacoesDto | null>(null);
  const [aberto, setAberto] = useState(false);

  const atualizar = useCallback(async () => {
    const resultado = await listarNotificacoes();
    // Erro (sessão expirada, rede): mantém o que já estava na tela.
    if (resultado.ok) setLista(resultado.dados);
  }, []);

  // Ao navegar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza com o servidor
    void atualizar();
  }, [atualizar, pathname]);

  // A cada 60s, só com a aba visível.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void atualizar();
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [atualizar]);

  function aoMudar(proximo: boolean) {
    setAberto(proximo);
    if (proximo) void atualizar();
  }

  function aoAbrirNotificacao(notificacao: NotificacaoDto) {
    setAberto(false);
    if (notificacao.lida) return;
    // Atualização otimista: o contador cai na hora; o servidor confirma em seguida.
    setLista((atual) =>
      atual
        ? {
            itens: atual.itens.map((n) => (n.id === notificacao.id ? { ...n, lida: true } : n)),
            naoLidas: Math.max(0, atual.naoLidas - 1),
          }
        : atual,
    );
    void marcarComoLida({ id: notificacao.id }).then(() => atualizar());
  }

  async function aoMarcarTodas() {
    setLista((atual) => (atual ? { itens: atual.itens.map((n) => ({ ...n, lida: true })), naoLidas: 0 } : atual));
    await marcarTodasComoLidas();
    await atualizar();
  }

  const naoLidas = lista?.naoLidas ?? 0;
  const rotuloContador = naoLidas > 99 ? "99+" : String(naoLidas);

  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
          className="relative flex size-10 items-center justify-center rounded-md outline-none transition-colors duration-150 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
        >
          <Icone nome="notifications" tamanho={24} />
          {naoLidas > 0 ? (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[11px] leading-none font-bold text-grafite"
            >
              {rotuloContador}
            </span>
          ) : null}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        {/* Sem escurecer no desktop: o painel é um menu, não um modal. */}
        <Dialog.Overlay className="fixed inset-0 z-50 lg:bg-transparent" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-card outline-none lg:inset-auto lg:top-14 lg:right-4 lg:max-h-[min(32rem,calc(100dvh-4.5rem))] lg:w-[24rem] lg:rounded-md lg:border lg:border-border"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-1">
            <Dialog.Title className="text-base font-medium">Notificações</Dialog.Title>
            <Dialog.Close
              aria-label="Fechar"
              className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Icone nome="close" tamanho={20} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {lista === null ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : lista.itens.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação.</p>
            ) : (
              <ul>
                {lista.itens.map((notificacao) => (
                  <li key={notificacao.id} className="border-b border-border last:border-b-0">
                    <Link
                      href={notificacao.link}
                      onClick={() => aoAbrirNotificacao(notificacao)}
                      className={`flex flex-col gap-0.5 border-l-4 px-4 py-3 outline-none hover:bg-accent focus-visible:bg-accent ${
                        notificacao.lida ? "border-transparent" : "border-primary"
                      }`}
                    >
                      <span className={`text-sm ${notificacao.lida ? "" : "font-medium"}`}>{notificacao.mensagem}</span>
                      <span className="text-xs text-muted-foreground">{formatarDataRelativa(notificacao.criadoEm)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-border p-2">
            <Button variant="link" className="w-full" disabled={naoLidas === 0} onClick={aoMarcarTodas}>
              Marcar todas como lidas
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
