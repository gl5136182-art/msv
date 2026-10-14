// Esqueleto do dashboard (DESIGN §6: skeletons cinza, sem spinners): cabeçalho escuro, KPIs e gráficos.
export default function Carregando() {
  return (
    <div aria-hidden className="-mx-4 -mt-4 bg-cinza lg:mx-0 lg:mt-0 lg:overflow-hidden lg:rounded-md">
      <div className="h-24 bg-grafite" />
      <div className="flex flex-col gap-2 p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-md bg-card" />
          ))}
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          <div className="h-72 rounded-md bg-card lg:col-span-2" />
          <div className="h-72 rounded-md bg-card" />
          <div className="h-72 rounded-md bg-card" />
        </div>
      </div>
    </div>
  );
}
