import { rotuloUt } from "@/lib/rotulo-ut";
import type { ContatoDto, UtResumoDto } from "@/modules/solicitacoes/solicitacoes.schemas";

// "Contato para transporte" (SPEC §3, regra 12; DESIGN §6): origem e destino lado a lado, com
// e-mail e telefone clicáveis. O endereço exato é combinado entre as duas UTs, por fora do sistema.
export function ContatoTransporte({
  origem,
  destino,
}: {
  origem: { ut: UtResumoDto; contato: ContatoDto | null };
  destino: { ut: UtResumoDto; contato: ContatoDto };
}) {
  return (
    <section aria-label="Contato para transporte" className="rounded-md border border-border bg-muted p-3">
      <h3 className="mb-2 text-sm font-medium">Contato para transporte</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Lado titulo="Origem" ut={origem.ut} contato={origem.contato} />
        <Lado titulo="Destino" ut={destino.ut} contato={destino.contato} />
      </div>
    </section>
  );
}

function Lado({ titulo, ut, contato }: { titulo: string; ut: UtResumoDto; contato: ContatoDto | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase">{titulo}</p>
      <p className="font-medium">{rotuloUt(ut)}</p>
      {contato ? (
        <>
          <p>{contato.nome}</p>
          <a href={`mailto:${contato.email}`} className="w-fit max-w-full truncate underline">
            {contato.email}
          </a>
          {contato.telefone ? (
            <a href={`tel:${contato.telefone.replace(/[^\d+]/g, "")}`} className="w-fit underline">
              {contato.telefone}
            </a>
          ) : (
            <p className="text-muted-foreground">Telefone não informado</p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">Responsável não identificado</p>
      )}
    </div>
  );
}
