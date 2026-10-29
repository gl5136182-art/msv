// Esqueleto do dashboard (DESIGN §6: skeletons cinza, sem spinners): cabeçalho, resumo, gráficos e simulador.
export default function Carregando() {
  return (
    <div aria-hidden className="-mx-4 -mt-4 bg-cinza lg:mx-0 lg:mt-0 lg:overflow-hidden lg:rounded-md">
      <div className="flex h-24 flex-col gap-2 bg-grafite px-4 pt-4 pb-3">
        <div className="h-5 w-48 bg-white/20" />
        <div className="h-3 w-56 bg-white/20" />
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="h-24 rounded-md bg-card lg:h-[68px]" />
        <div className="grid gap-2 lg:grid-cols-2">
          <div className="h-60 rounded-md bg-card" />
          <div className="h-60 rounded-md bg-card" />
        </div>
        <div className="h-48 rounded-md bg-card" />
      </div>
    </div>
  );
}
