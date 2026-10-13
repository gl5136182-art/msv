"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import type { CredenciaisGeradasDto } from "@/modules/usuarios/usuarios.schemas";

type ModalSenhaGeradaProps = {
  credenciais: CredenciaisGeradasDto | null;
  titulo: string;
  aoFechar: () => void;
};

// Modal de senha gerada (DESIGN §6): dados de acesso em caixa cinza, senha em monoespaçada
// 20px, aviso de que não será exibida de novo e o botão "Copiar dados de acesso".
export function ModalSenhaGerada({ credenciais, titulo, aoFechar }: ModalSenhaGeradaProps) {
  async function copiar() {
    if (!credenciais) return;
    const { usuario, senhaGerada } = credenciais;

    const texto = [
      "MSV: dados de acesso",
      `Acesso: ${window.location.origin}`,
      `E-mail: ${usuario.email}`,
      `CPF: ${usuario.cpf}`,
      `Senha: ${senhaGerada}`,
      "",
      "A senha é provisória: o sistema pede a troca no primeiro acesso.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Dados de acesso copiados.");
    } catch {
      toast.error("Não foi possível copiar. Anote os dados desta tela.");
    }
  }

  return (
    <Dialogo
      aberto={credenciais !== null}
      aoMudar={(aberto) => !aberto && aoFechar()}
      titulo={titulo}
      rodape={
        <>
          <Button variant="secondary" onClick={aoFechar}>
            Fechar
          </Button>
          <Button onClick={copiar}>Copiar dados de acesso</Button>
        </>
      }
    >
      {credenciais ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Repasse os dados a <strong>{credenciais.usuario.nome}</strong>. A senha é provisória: no
            primeiro acesso o sistema pede a troca.
          </p>

          <dl className="flex flex-col gap-3 rounded-md bg-background p-4">
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd className="mt-0.5 text-sm break-all">{credenciais.usuario.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">CPF</dt>
              <dd className="mt-0.5 text-sm">{credenciais.usuario.cpf}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Senha</dt>
              <dd className="mt-0.5 font-mono text-xl break-all select-all">{credenciais.senhaGerada}</dd>
            </div>
          </dl>

          <p className="text-sm font-medium">Esta senha não será exibida novamente.</p>
        </div>
      ) : null}
    </Dialogo>
  );
}
