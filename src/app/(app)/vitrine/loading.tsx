// Esqueleto da vitrine (DESIGN §6: skeletons cinza, sem spinners): barra de filtros e grade de cards.
export default function Carregando() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <div className="h-8 w-40 rounded-md bg-cinza" />
      <div className="h-40 rounded-md bg-cinza lg:h-32" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-md bg-cinza" />
        ))}
      </div>
    </div>
  );
}
