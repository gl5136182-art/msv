"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { comprimirImagem, type ImagemComprimida } from "@/lib/comprimir-imagem";
import { enviarArquivo } from "@/lib/enviar-arquivo";
import { prepararUploadFotos } from "@/modules/itens/itens.actions";
import { MAXIMO_FOTOS } from "@/modules/itens/itens.schemas";

// Fotos do item no cadastro (SPEC §6.1, DESIGN §6): 1 a 5 fotos, câmera ou galeria, compressão
// no aparelho, upload direto ao storage com progresso, "tentar de novo", capa e remover.

export type SituacaoFoto = "processando" | "enviando" | "enviada" | "erro";

export type FotoFormulario = {
  /** Identificador local, só para a lista da tela. */
  id: string;
  situacao: SituacaoFoto;
  /** 0 a 100, durante o envio. */
  progresso: number;
  /** URL para exibir a miniatura (`blob:` para fotos novas, URL assinada para as já salvas). */
  previa: string | null;
  /** Chaves no storage; preenchidas quando a foto foi enviada. */
  chave: string | null;
  chaveThumb: string | null;
  erro: string | null;
};

type CampoFotosProps = {
  /** Fotos já salvas (edição). Lidas só na montagem. */
  fotosIniciais?: FotoFormulario[];
  /** Chamado a cada mudança da lista, na ordem exibida (a primeira é a capa). */
  aoMudar: (fotos: FotoFormulario[]) => void;
  /** Mensagem de validação do formulário (ex.: "Adicione ao menos uma foto."). */
  erro?: string;
  desabilitado?: boolean;
};

type DadosLocais = { arquivo: File; imagem?: ImagemComprimida };

const ehBlob = (url: string | null) => url?.startsWith("blob:") === true;

export function CampoFotos({ fotosIniciais = [], aoMudar, erro, desabilitado }: CampoFotosProps) {
  const [fotos, setFotos] = useState<FotoFormulario[]>(fotosIniciais);
  const [aviso, setAviso] = useState<string | null>(null);

  // Arquivo original e versões comprimidas ficam fora do estado: são pesados e só servem para
  // reenviar. Saem do mapa quando a foto é enviada ou removida.
  const dadosRef = useRef(new Map<string, DadosLocais>());
  // Comprime uma foto por vez: vários canvases grandes juntos estouram a memória de aparelhos simples.
  const filaCompressaoRef = useRef<Promise<unknown>>(Promise.resolve());
  const previasRef = useRef(new Set<string>());
  const aoMudarRef = useRef(aoMudar);

  useEffect(() => {
    aoMudarRef.current = aoMudar;
  }, [aoMudar]);

  useEffect(() => {
    aoMudarRef.current(fotos);
  }, [fotos]);

  useEffect(() => {
    const previas = previasRef.current;
    return () => {
      for (const url of previas) URL.revokeObjectURL(url);
    };
  }, []);

  const atualizar = useCallback((id: string, parcial: Partial<FotoFormulario>) => {
    setFotos((atuais) => atuais.map((f) => (f.id === id ? { ...f, ...parcial } : f)));
  }, []);

  const processar = useCallback(
    async (id: string) => {
      const dados = dadosRef.current.get(id);
      if (!dados) return;

      try {
        if (!dados.imagem) {
          atualizar(id, { situacao: "processando", progresso: 0, erro: null });
          const arquivo = dados.arquivo;
          const comprimida = filaCompressaoRef.current.then(() => comprimirImagem(arquivo));
          filaCompressaoRef.current = comprimida.catch(() => undefined);
          dados.imagem = await comprimida;
          if (!dadosRef.current.has(id)) return; // removida enquanto processava

          const previa = URL.createObjectURL(dados.imagem.miniatura);
          previasRef.current.add(previa);
          atualizar(id, { previa });
        }

        const { principal, miniatura } = dados.imagem;
        atualizar(id, { situacao: "enviando", progresso: 0, erro: null });

        // URLs novas a cada tentativa: a chave anterior pode ter ficado reservada pela metade.
        const preparo = await prepararUploadFotos({ quantidade: 1 });
        if (!preparo.ok) throw new Error(preparo.erro);
        if (!dadosRef.current.has(id)) return;
        const [envio] = preparo.dados;

        const total = principal.size + miniatura.size;
        let enviadoPrincipal = 0;
        let enviadoMiniatura = 0;
        const informar = () =>
          atualizar(id, {
            progresso: Math.min(99, Math.round(((enviadoPrincipal + enviadoMiniatura) / total) * 100)),
          });

        await Promise.all([
          enviarArquivo(envio.urlUpload, principal, (n) => {
            enviadoPrincipal = n;
            informar();
          }),
          enviarArquivo(envio.urlUploadThumb, miniatura, (n) => {
            enviadoMiniatura = n;
            informar();
          }),
        ]);

        dadosRef.current.delete(id);
        atualizar(id, {
          situacao: "enviada",
          progresso: 100,
          chave: envio.chave,
          chaveThumb: envio.chaveThumb,
          erro: null,
        });
      } catch (e) {
        atualizar(id, {
          situacao: "erro",
          erro: e instanceof Error ? e.message : "Não foi possível enviar a foto.",
        });
      }
    },
    [atualizar],
  );

  function aoEscolher(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const imagens = Array.from(lista).filter((a) => a.type.startsWith("image/"));
    const livres = MAXIMO_FOTOS - fotos.length;
    const aceitas = imagens.slice(0, Math.max(0, livres));

    const avisos: string[] = [];
    if (imagens.length < lista.length) avisos.push("Alguns arquivos não são imagens e foram ignorados.");
    if (imagens.length > aceitas.length) avisos.push(`Cada item aceita no máximo ${MAXIMO_FOTOS} fotos.`);
    setAviso(avisos.length > 0 ? avisos.join(" ") : null);
    if (aceitas.length === 0) return;

    const novas: FotoFormulario[] = aceitas.map((arquivo) => {
      const id = crypto.randomUUID();
      dadosRef.current.set(id, { arquivo });
      return { id, situacao: "processando", progresso: 0, previa: null, chave: null, chaveThumb: null, erro: null };
    });
    setFotos((atuais) => [...atuais, ...novas]);
    for (const nova of novas) void processar(nova.id);
  }

  function remover(id: string) {
    const foto = fotos.find((f) => f.id === id);
    dadosRef.current.delete(id);
    if (foto?.previa && ehBlob(foto.previa)) {
      URL.revokeObjectURL(foto.previa);
      previasRef.current.delete(foto.previa);
    }
    setAviso(null);
    setFotos((atuais) => atuais.filter((f) => f.id !== id));
  }

  function tornarCapa(id: string) {
    setFotos((atuais) => {
      const alvo = atuais.find((f) => f.id === id);
      return alvo ? [alvo, ...atuais.filter((f) => f.id !== id)] : atuais;
    });
  }

  const cheio = fotos.length >= MAXIMO_FOTOS;
  const emAndamento = fotos.some((f) => f.situacao === "processando" || f.situacao === "enviando");

  return (
    <div data-slot="campo-fotos" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id="fotos-rotulo" className="text-xs font-medium text-foreground">
          Fotos
          <span aria-hidden className="ml-0.5">
            *
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {fotos.length} de {MAXIMO_FOTOS}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <label className={cheio || desabilitado ? "pointer-events-none opacity-50" : "cursor-pointer"}>
            <Icone nome="add_a_photo" />
            Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={desabilitado || cheio}
              onChange={(e) => {
                aoEscolher(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <label className={cheio || desabilitado ? "pointer-events-none opacity-50" : "cursor-pointer"}>
            <Icone nome="photo_library" />
            Galeria
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={desabilitado || cheio}
              onChange={(e) => {
                aoEscolher(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      </div>

      {fotos.length > 0 ? (
        <ul aria-labelledby="fotos-rotulo" className="flex flex-wrap gap-3 pt-1">
          {fotos.map((foto, indice) => (
            <li key={foto.id} className="flex w-20 flex-col gap-1">
              <div
                className={`relative size-20 rounded-md border bg-cinza ${
                  foto.situacao === "erro" ? "border-destructive" : "border-border"
                }`}
              >
                {foto.previa ? (
                  // URL assinada/blob: o otimizador do Next não cacheia, então <img> simples (SPEC §6.3).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={foto.previa}
                    alt={`Foto ${indice + 1}`}
                    className="size-full rounded-md object-cover"
                  />
                ) : null}

                {indice === 0 ? (
                  <span className="absolute bottom-1 left-1 rounded-sm bg-foreground px-1 text-[11px] font-medium text-white">
                    Capa
                  </span>
                ) : null}

                {foto.situacao === "processando" || foto.situacao === "enviando" ? (
                  <div
                    role="progressbar"
                    aria-label={`Foto ${indice + 1}: ${foto.situacao === "processando" ? "preparando" : "enviando"}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={foto.situacao === "enviando" ? foto.progresso : undefined}
                    className="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-md bg-border"
                  >
                    <div
                      className={`h-full bg-primary ${foto.situacao === "processando" ? "w-1/4" : ""}`}
                      style={foto.situacao === "enviando" ? { width: `${foto.progresso}%` } : undefined}
                    />
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => remover(foto.id)}
                  disabled={desabilitado}
                  aria-label={`Remover foto ${indice + 1}`}
                  className="absolute -top-3 -right-3 flex size-11 items-center justify-center outline-none disabled:opacity-50"
                >
                  <span className="flex size-6 items-center justify-center rounded-md border border-input bg-card text-foreground">
                    <Icone nome="close" tamanho={16} />
                  </span>
                </button>
              </div>

              {foto.situacao === "erro" ? (
                <>
                  <button
                    type="button"
                    onClick={() => void processar(foto.id)}
                    disabled={desabilitado}
                    className="flex min-h-11 items-center gap-1 text-left text-xs text-foreground underline underline-offset-2 disabled:opacity-50"
                  >
                    <Icone nome="refresh" tamanho={16} />
                    Tentar de novo
                  </button>
                  <p role="alert" className="text-[11px] leading-snug text-destructive">
                    {foto.erro}
                  </p>
                </>
              ) : foto.situacao === "enviada" && indice > 0 ? (
                <button
                  type="button"
                  onClick={() => tornarCapa(foto.id)}
                  disabled={desabilitado}
                  className="min-h-11 text-left text-xs text-foreground underline underline-offset-2 disabled:opacity-50"
                >
                  Tornar capa
                </button>
              ) : foto.situacao === "enviada" ? null : (
                <span className="text-[11px] text-muted-foreground">
                  {foto.situacao === "processando" ? "Preparando…" : `Enviando ${foto.progresso}%`}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Adicione de 1 a {MAXIMO_FOTOS} fotos. A primeira é a capa.</p>
      )}

      {emAndamento ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Aguarde o envio das fotos para salvar.
        </p>
      ) : null}
      {aviso ? <p className="text-xs text-muted-foreground">{aviso}</p> : null}
      {erro ? (
        <p role="alert" className="text-xs text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
