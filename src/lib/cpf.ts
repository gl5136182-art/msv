// CPF: limpeza, validação, máscara e mascaramento LGPD (CLAUDE.md, Convenções).
// Funções puras. O banco guarda só os 11 dígitos; a máscara é apenas de exibição.
// Nunca registrar CPF em logs.

const TAMANHO = 11;

/** Só os dígitos: `123.456.789-09` → `12345678909`. */
export function limparCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

/**
 * Se o texto digitado no login deve ser tratado como CPF (SPEC §4): sem pontuação tem 11
 * dígitos. Só aceita dígitos, ponto, hífen e espaço, para que um e-mail nunca seja confundido.
 */
export function pareceCpf(valor: string): boolean {
  const texto = valor.trim();
  return /^[\d.\-\s]+$/.test(texto) && limparCpf(texto).length === TAMANHO;
}

/** Valida os 11 dígitos e os dois dígitos verificadores. Aceita com ou sem máscara. */
export function cpfValido(valor: string): boolean {
  const cpf = limparCpf(valor);
  if (cpf.length !== TAMANHO) return false;
  // Sequências como 111.111.111-11 passam na conta dos dígitos, mas não são CPFs válidos.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split("").map(Number);
  return (
    digitoVerificador(digitos.slice(0, 9)) === digitos[9] &&
    digitoVerificador(digitos.slice(0, 10)) === digitos[10]
  );
}

/** `12345678909` → `123.456.789-09`. Texto que não tem 11 dígitos volta sem alteração. */
export function formatarCpf(valor: string): string {
  const cpf = limparCpf(valor);
  if (cpf.length !== TAMANHO) return valor;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

/**
 * Máscara progressiva para o campo de CPF enquanto o usuário digita: `5299` → `529.9`,
 * `52998224725` → `529.982.247-25`. Ignora o que não é dígito e corta em 11 dígitos.
 */
export function aplicarMascaraCpf(valor: string): string {
  const digitos = limparCpf(valor).slice(0, TAMANHO);
  const partes = [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 9)].filter(Boolean);
  const base = partes.join(".");
  return digitos.length > 9 ? `${base}-${digitos.slice(9)}` : base;
}

/**
 * Exibição fora da tela de admin (LGPD): `12345678909` → `***.456.789-**`.
 * Texto que não tem 11 dígitos volta sem alteração.
 */
export function mascararCpf(valor: string): string {
  const cpf = limparCpf(valor);
  if (cpf.length !== TAMANHO) return valor;
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

function digitoVerificador(base: number[]): number {
  const peso = base.length + 1;
  const soma = base.reduce((total, digito, i) => total + digito * (peso - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}
