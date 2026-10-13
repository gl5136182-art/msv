import { filtrosVitrineSchema, type FiltrosVitrine } from "@/modules/itens/itens.schemas";

// Parâmetros da URL da vitrine: `q`, `categoria`, `uf`, `ut`, `condicao`, `ordem` e `pagina`.
// `q` é o nome que o formulário de busca da barra superior já envia. Funções puras.

type ParametrosUrl = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** Lê os filtros da URL. Valor inválido ou vazio volta ao padrão (o schema é tolerante). */
export function filtrosDosParametros(parametros: ParametrosUrl): FiltrosVitrine {
  return filtrosVitrineSchema.parse({
    busca: primeiro(parametros.q),
    categoria: primeiro(parametros.categoria),
    segmento: primeiro(parametros.segmento),
    uf: primeiro(parametros.uf),
    utId: primeiro(parametros.ut),
    estado: primeiro(parametros.condicao),
    ordenar: primeiro(parametros.ordem),
    pagina: primeiro(parametros.pagina),
  });
}

/** Monta o link da vitrine com os filtros atuais, aplicando `alteracoes`. Omite o que é padrão. */
export function hrefVitrine(filtros: FiltrosVitrine, alteracoes: Partial<FiltrosVitrine> = {}): string {
  const f = { ...filtros, ...alteracoes };
  const parametros = new URLSearchParams();
  if (f.busca) parametros.set("q", f.busca);
  if (f.categoria) parametros.set("categoria", f.categoria);
  if (f.segmento) parametros.set("segmento", f.segmento);
  if (f.uf) parametros.set("uf", f.uf);
  if (f.utId) parametros.set("ut", f.utId);
  if (f.estado) parametros.set("condicao", f.estado);
  if (f.ordenar !== "recentes") parametros.set("ordem", f.ordenar);
  if (f.pagina > 1) parametros.set("pagina", String(f.pagina));

  const texto = parametros.toString();
  return texto ? `/vitrine?${texto}` : "/vitrine";
}

/** Há algum filtro ou busca aplicado (a ordenação e a página não contam). */
export function temFiltros(filtros: FiltrosVitrine): boolean {
  return Boolean(
    filtros.busca || filtros.categoria || filtros.segmento || filtros.uf || filtros.utId || filtros.estado,
  );
}
