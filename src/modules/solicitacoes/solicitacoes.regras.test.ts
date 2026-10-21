import { describe, expect, it } from "vitest";

import { acoesPermitidas } from "./solicitacoes.regras";
import type { StatusSolicitacao } from "./solicitacoes.schemas";

const solicitacao = (status: StatusSolicitacao) => ({
  status,
  solicitanteId: "col",
  utDestinoId: "ut2",
  utOrigemId: "ut1",
});

const solicitante = { id: "col", papel: "colaborador" as const, utId: "ut2", utsAdicionais: [] };
const almoxarifeOrigem = { id: "alm1", papel: "almoxarife" as const, utId: "ut1", utsAdicionais: [] };
const almoxarifeDestino = { id: "alm2", papel: "almoxarife" as const, utId: "ut2", utsAdicionais: [] };
const outroColaboradorDoDestino = { id: "col2", papel: "colaborador" as const, utId: "ut2", utsAdicionais: [] };
const admin = { id: "adm", papel: "admin" as const, utId: null, utsAdicionais: [] };

const nenhuma = { aceitar: false, recusar: false, cancelar: false, concluir: false };

describe("acoesPermitidas", () => {
  it("pendente: o almoxarife de origem aceita e recusa; o solicitante cancela", () => {
    expect(acoesPermitidas(almoxarifeOrigem, solicitacao("pendente"))).toEqual({
      ...nenhuma,
      aceitar: true,
      recusar: true,
    });
    expect(acoesPermitidas(solicitante, solicitacao("pendente"))).toEqual({ ...nenhuma, cancelar: true });
  });

  it("aceita: solicitante e almoxarife de destino concluem; solicitante e almoxarife de origem cancelam", () => {
    expect(acoesPermitidas(solicitante, solicitacao("aceita"))).toEqual({ ...nenhuma, cancelar: true, concluir: true });
    expect(acoesPermitidas(almoxarifeDestino, solicitacao("aceita"))).toEqual({ ...nenhuma, concluir: true });
    expect(acoesPermitidas(almoxarifeOrigem, solicitacao("aceita"))).toEqual({ ...nenhuma, cancelar: true });
  });

  it("outro colaborador da UT de destino e o admin não têm ações", () => {
    for (const status of ["pendente", "aceita"] as const) {
      expect(acoesPermitidas(outroColaboradorDoDestino, solicitacao(status))).toEqual(nenhuma);
      expect(acoesPermitidas(admin, solicitacao(status))).toEqual(nenhuma);
    }
  });

  it.each(["recusada", "cancelada", "concluida"] as const)("%s: ninguém tem ações", (status) => {
    for (const usuario of [solicitante, almoxarifeOrigem, almoxarifeDestino, admin]) {
      expect(acoesPermitidas(usuario, solicitacao(status))).toEqual(nenhuma);
    }
  });
});
