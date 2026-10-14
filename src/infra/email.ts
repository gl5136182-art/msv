// Envio de e-mail (SPEC §6.4, opcional): único lugar que fala com o Resend, atrás de uma função
// neutra. Sem `RESEND_API_KEY` (ou sem `EMAIL_FROM`) nada é enviado e o app segue normal.
// Falha de envio nunca lança: o e-mail é complemento da notificação, não parte da ação.

const URL_RESEND = "https://api.resend.com/emails";
const TIMEOUT_MS = 5_000;

export type Email = {
  para: string;
  assunto: string;
  /** Corpo em texto simples. */
  texto: string;
};

/** `true` se o provedor aceitou o e-mail; `false` se o envio está desligado ou falhou. */
export async function enviarEmail(email: Email): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_FROM;
  if (!chave || !remetente) return false;

  try {
    const resposta = await fetch(URL_RESEND, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remetente, to: [email.para], subject: email.assunto, text: email.texto }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) {
      // Sem o destinatário no log: e-mail é dado pessoal (LGPD).
      console.error("Falha ao enviar e-mail: o provedor respondeu", resposta.status);
      return false;
    }
    return true;
  } catch (erro) {
    console.error("Falha ao enviar e-mail:", erro instanceof Error ? erro.message : erro);
    return false;
  }
}
