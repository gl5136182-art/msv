// Esqueleto do detalhe do item (DESIGN §6): galeria à esquerda e blocos de dados à direita.
export default function Carregando() {
  return (
    <div aria-hidden className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-5 lg:gap-6">
      <div className="aspect-[4/3] rounded-md bg-cinza lg:col-span-3" />
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="h-56 rounded-md bg-cinza" />
        <div className="h-32 rounded-md bg-cinza" />
      </div>
    </div>
  );
}
