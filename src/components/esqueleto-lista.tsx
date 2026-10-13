// Esqueleto cinza (DESIGN §6: sem spinners decorativos) para telas de lista enquanto os dados
// chegam. Cada seção com leitura de dados usa o seu `loading.tsx`: ele precisa ficar na mesma
// pasta da página, abaixo de qualquer layout compartilhado com as rotas irmãs.
export function EsqueletoLista({ linhas = 5 }: { linhas?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="h-10 w-full max-w-md rounded-md bg-cinza" />
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="h-11 rounded-md bg-cinza" />
      ))}
    </div>
  );
}
