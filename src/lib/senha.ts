import { randomInt } from "node:crypto";

// Gerador da senha inicial/redefinida pelo admin (SPEC §6.0): 10 caracteres, aleatória, com
// `crypto`, sem os caracteres que se confundem na leitura (0, O, 1, l, I). Só no servidor.

const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I e O
const MINUSCULAS = "abcdefghijkmnopqrstuvwxyz"; // sem l
const DIGITOS = "23456789"; // sem 0 e 1
const TODOS = MAIUSCULAS + MINUSCULAS + DIGITOS;

export const TAMANHO_SENHA_GERADA = 10;

/**
 * Senha aleatória de `tamanho` caracteres (padrão 10). Tem ao menos uma maiúscula, uma
 * minúscula e um dígito, para ser aceita por qualquer regra de composição comum.
 */
export function gerarSenha(tamanho: number = TAMANHO_SENHA_GERADA): string {
  if (!Number.isInteger(tamanho) || tamanho < 3) {
    throw new RangeError("A senha precisa ter ao menos 3 caracteres.");
  }

  const caracteres = [sortear(MAIUSCULAS), sortear(MINUSCULAS), sortear(DIGITOS)];
  while (caracteres.length < tamanho) caracteres.push(sortear(TODOS));

  // Embaralha (Fisher-Yates) para os três obrigatórios não ficarem sempre no começo.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}

function sortear(alfabeto: string): string {
  return alfabeto[randomInt(alfabeto.length)];
}
