// Compressão de imagem no NAVEGADOR, antes do upload (CLAUDE.md, Convenções):
//   principal: lado maior 1600px, JPEG ~0.8
//   miniatura: lado maior  400px, JPEG ~0.7
// Só roda no cliente (usa canvas). O cálculo de dimensões é puro e testado em separado.

export const LADO_MAIOR_PRINCIPAL = 1600;
export const QUALIDADE_PRINCIPAL = 0.8;
export const LADO_MAIOR_MINIATURA = 400;
export const QUALIDADE_MINIATURA = 0.7;

export type ImagemComprimida = {
  principal: Blob;
  miniatura: Blob;
};

/**
 * Reduz (largura, altura) para que o lado maior caiba em `ladoMaior`, mantendo a proporção.
 * Nunca amplia: imagem menor que o limite mantém o tamanho original.
 */
export function calcularDimensoes(
  largura: number,
  altura: number,
  ladoMaior: number,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= ladoMaior) return { largura, altura };
  const escala = ladoMaior / maior;
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

type Origem = { fonte: CanvasImageSource; largura: number; altura: number; liberar: () => void };

/** Decodifica o arquivo já com a orientação EXIF aplicada (foto de celular vem "deitada"). */
async function decodificar(arquivo: File): Promise<Origem> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      return { fonte: bitmap, largura: bitmap.width, altura: bitmap.height, liberar: () => bitmap.close() };
    } catch {
      // Alguns navegadores não aceitam as opções ou o formato; cai para <img>.
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      fonte: img,
      largura: img.naturalWidth,
      altura: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Não foi possível ler esta imagem. Tente outra foto.");
  }
}

function paraJpeg(fonte: CanvasImageSource, largura: number, altura: number, qualidade: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste aparelho.");
  // JPEG não tem transparência: fundo branco evita fotos/PNGs com alfa ficarem pretas.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(fonte, 0, 0, largura, altura);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível processar a imagem."))),
      "image/jpeg",
      qualidade,
    );
    // Libera a memória do canvas (relevante no Safari iOS, que limita a área total de canvas).
    canvas.width = 0;
    canvas.height = 0;
  });
}

/** Gera a versão principal e a miniatura de uma foto, ambas em JPEG. */
export async function comprimirImagem(arquivo: File): Promise<ImagemComprimida> {
  const origem = await decodificar(arquivo);
  try {
    if (origem.largura <= 0 || origem.altura <= 0) {
      throw new Error("Não foi possível ler esta imagem. Tente outra foto.");
    }
    const dimPrincipal = calcularDimensoes(origem.largura, origem.altura, LADO_MAIOR_PRINCIPAL);
    const dimMiniatura = calcularDimensoes(origem.largura, origem.altura, LADO_MAIOR_MINIATURA);
    // Em sequência, não em paralelo: dois canvases grandes ao mesmo tempo estouram a memória
    // de aparelhos mais simples.
    const principal = await paraJpeg(origem.fonte, dimPrincipal.largura, dimPrincipal.altura, QUALIDADE_PRINCIPAL);
    const miniatura = await paraJpeg(origem.fonte, dimMiniatura.largura, dimMiniatura.altura, QUALIDADE_MINIATURA);
    return { principal, miniatura };
  } finally {
    origem.liberar();
  }
}
