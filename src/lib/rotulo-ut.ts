// Rótulo da UT onde ela aparece (vitrine, dashboard): "Nome da UT · Cidade/UF"
// (SPEC §6.0). Função pura.

export function rotuloUt(ut: { nome: string; cidade: string; uf: string }): string {
  return `${ut.nome} · ${ut.cidade}/${ut.uf}`;
}
