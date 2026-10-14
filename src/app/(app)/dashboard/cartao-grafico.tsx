import type { ReactNode } from "react";

// Card de gráfico (DESIGN §7, item 5): título no canto superior esquerdo, gráfico, legenda no
// canto inferior esquerdo com bolinhas. A legenda só aparece com 2 ou mais séries (uma série
// única é nomeada pelo título). A tabela `sr-only` é a alternativa de leitura para quem não vê o gráfico.
type Props = {
  titulo: string;
  legenda?: Array<{ rotulo: string; cor: string }>;
  tabela: { colunas: string[]; linhas: Array<Array<string | number>> };
  className?: string;
  children: ReactNode;
};

export function CartaoGrafico({ titulo, legenda, tabela, className, children }: Props) {
  return (
    <section className={`flex flex-col gap-2 rounded-md bg-card p-2.5 ${className ?? ""}`} aria-label={titulo}>
      <h2 className="text-[13px] font-medium">{titulo}</h2>

      {tabela.linhas.length === 0 ? (
        <p className="flex min-h-32 flex-1 items-center text-sm text-muted-foreground">Sem dados no período.</p>
      ) : (
        <>
          <div className="min-w-0 flex-1">{children}</div>

          {legenda && legenda.length > 1 ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-light">
              {legenda.map((item) => (
                <li key={item.rotulo} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: item.cor }} />
                  {item.rotulo}
                </li>
              ))}
            </ul>
          ) : null}

          <table className="sr-only">
            <caption>{titulo}</caption>
            <thead>
              <tr>
                {tabela.colunas.map((coluna) => (
                  <th key={coluna} scope="col">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((linha, i) => (
                <tr key={i}>
                  {linha.map((celula, j) => (
                    <td key={j}>{celula}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
