// Casca das telas sem sessão (login e troca obrigatória de senha): sem barra superior nem
// navegação. O cartão fica alinhado ao topo, sem hero nem ilustração (DESIGN §1).
export default function LayoutAuth({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh items-start justify-center p-4 pt-10 lg:pt-20">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
