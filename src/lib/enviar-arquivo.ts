// Envio de um arquivo para uma URL assinada de upload (ver `criarUrlsUpload` em infra/storage).
// Usa XMLHttpRequest porque `fetch` não informa o progresso do envio. Só roda no navegador.

/**
 * Envia `arquivo` com `PUT` (o arquivo no corpo, com o próprio Content-Type).
 * `aoProgredir` recebe os bytes já enviados. Rejeita com mensagem pronta para o usuário.
 */
export function enviarArquivo(
  url: string,
  arquivo: Blob,
  aoProgredir?: (bytesEnviados: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", arquivo.type || "image/jpeg");

    xhr.upload.onprogress = (evento) => {
      if (evento.lengthComputable) aoProgredir?.(evento.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        aoProgredir?.(arquivo.size);
        resolve();
      } else {
        reject(new Error("Não foi possível enviar a foto. Tente de novo."));
      }
    };
    xhr.onerror = () => reject(new Error("Sem conexão. Verifique o sinal e tente de novo."));
    xhr.ontimeout = () => reject(new Error("O envio demorou demais. Tente de novo."));
    xhr.timeout = 120_000;

    xhr.send(arquivo);
  });
}
