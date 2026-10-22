// Modelo de linguagem (SPEC §6.6): único lugar que fala com o provedor de IA, atrás de uma função
// neutra. Usa a API de chat compatível com a da OpenAI, que DeepSeek e Kimi (Moonshot) expõem:
//   DeepSeek: IA_BASE_URL="https://api.deepseek.com"     IA_MODEL="deepseek-chat"
//   Kimi:     IA_BASE_URL="https://api.moonshot.ai/v1"   IA_MODEL="kimi-k2.6"
// Sem `temperature`: os modelos Kimi atuais só aceitam o valor padrão (1) e recusam outro com 400.
// No Kimi o raciocínio ("thinking") vem ligado e deixa cada chamada em 40s ou mais; aqui ele é
// desligado, porque as tarefas são curtas (extrair termos, escolher entre candidatos).
// Sem `IA_API_KEY` a IA fica desligada e quem chama segue sem ela. Falha nunca lança: devolve
// `null` e registra o motivo (sem o conteúdo, que pode ter dados da empresa).

const BASE_URL_PADRAO = "https://api.deepseek.com";
const MODELO_PADRAO = "deepseek-chat";
const TIMEOUT_MS = 55_000;
/** Espera antes da nova tentativa em 429 (a conta Kimi gratuita tem limite de 3 pedidos/min). */
const ESPERA_429_MS = 2_000;

export type PedidoJson = {
  /** Instruções fixas (papel, regras e o formato do JSON esperado). */
  sistema: string;
  /** O caso a resolver. */
  usuario: string;
};

/** A IA está configurada? */
export function iaDisponivel(): boolean {
  return Boolean(process.env.IA_API_KEY);
}

/**
 * Pede uma resposta em JSON (modo `json_object`) e devolve o objeto lido, sem validar o formato:
 * quem chama valida com Zod. `null` se a IA está desligada, o provedor falhou ou a resposta não
 * é JSON. Uma nova tentativa em falha de rede ou 5xx/429.
 */
export async function completarJson(pedido: PedidoJson): Promise<unknown | null> {
  const chave = process.env.IA_API_KEY;
  if (!chave) return null;

  const baseUrl = (process.env.IA_BASE_URL || BASE_URL_PADRAO).replace(/\/+$/, "");
  const corpo = JSON.stringify({
    model: process.env.IA_MODEL || MODELO_PADRAO,
    ...(baseUrl.includes("moonshot") ? { thinking: { type: "disabled" } } : {}),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: pedido.sistema },
      { role: "user", content: pedido.usuario },
    ],
  });

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const resposta = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: corpo,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) {
        // A mensagem de erro do provedor diz o motivo (modelo inexistente, parâmetro inválido...).
        console.error("IA: o provedor respondeu", resposta.status, await mensagemDeErro(resposta));
        if (resposta.status === 429 && tentativa === 1) {
          await new Promise((ok) => setTimeout(ok, Number(resposta.headers.get("retry-after")) * 1000 || ESPERA_429_MS));
          continue;
        }
        if (resposta.status >= 500) continue;
        return null;
      }
      const dados = (await resposta.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
      const texto = dados.choices?.[0]?.message?.content;
      if (!texto) {
        console.error("IA: resposta sem conteúdo");
        return null;
      }
      return lerJson(texto);
    } catch (erro) {
      console.error("IA: falha na chamada:", erro instanceof Error ? erro.message : erro);
    }
  }
  return null;
}

/** Lê o JSON da resposta, mesmo quando o modelo o embrulha em ```json ... ``` (o Kimi às vezes faz). */
export function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio === -1 || fim <= inicio) throw new Error("resposta da IA não é JSON");
    return JSON.parse(texto.slice(inicio, fim + 1));
  }
}

async function mensagemDeErro(resposta: Response): Promise<string> {
  try {
    const corpo = (await resposta.json()) as { error?: { message?: string } };
    return (corpo.error?.message ?? "").slice(0, 200);
  } catch {
    return "";
  }
}
