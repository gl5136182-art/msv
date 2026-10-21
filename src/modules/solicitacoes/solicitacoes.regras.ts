import { temPapel, vinculadoAUt, type Papel } from "@/lib/usuario-logado";

import type { StatusSolicitacao } from "./solicitacoes.schemas";

// Quem pode fazer o quê com uma solicitação (SPEC §3, regras 7, 9 e 10). Função pura: a lista usa
// para decidir quais botões mostrar. A autorização de verdade continua no service, em cada ação.

export type AcoesDaSolicitacao = {
  aceitar: boolean;
  recusar: boolean;
  cancelar: boolean;
  concluir: boolean;
};

export function acoesPermitidas(
  usuario: { id: string; papel: Papel; utId: string | null; utsAdicionais: string[] },
  solicitacao: { status: StatusSolicitacao; solicitanteId: string; utDestinoId: string; utOrigemId: string },
): AcoesDaSolicitacao {
  const ehSolicitante = solicitacao.solicitanteId === usuario.id;
  const ehAlmoxarife = temPapel(usuario.papel, "almoxarife");
  const almoxarifeDeOrigem = ehAlmoxarife && vinculadoAUt(usuario, solicitacao.utOrigemId);
  const almoxarifeDeDestino = ehAlmoxarife && vinculadoAUt(usuario, solicitacao.utDestinoId);

  const pendente = solicitacao.status === "pendente";
  const aceita = solicitacao.status === "aceita";

  return {
    // Regra 7: só o almoxarife da UT de origem.
    aceitar: pendente && almoxarifeDeOrigem,
    recusar: pendente && almoxarifeDeOrigem,
    // Regra 9: o solicitante, enquanto pendente ou aceita; o almoxarife de origem, só a aceita.
    cancelar: (pendente && ehSolicitante) || (aceita && (ehSolicitante || almoxarifeDeOrigem)),
    // Regra 10: o solicitante ou um almoxarife da UT de destino.
    concluir: aceita && (ehSolicitante || almoxarifeDeDestino),
  };
}
