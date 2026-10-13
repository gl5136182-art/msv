// As 27 unidades da federação (SPEC §6.0: UF da UT é validada contra a lista de siglas).

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
  "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type Uf = (typeof UFS)[number];

export function ufValida(valor: string): valor is Uf {
  return (UFS as readonly string[]).includes(valor);
}
