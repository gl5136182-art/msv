"use client";

import Form from "next/form";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmarAcao } from "@/components/confirmar-acao";
import { Icone } from "@/components/icone";
import { Button } from "@/components/ui/button";
import { Dialogo } from "@/components/ui/dialogo";
import { Input } from "@/components/ui/input";
import { Selo } from "@/components/ui/selo";
import { ROTULO_PAPEL } from "@/lib/usuario-logado";
import type { UtDto } from "@/modules/uts/uts.schemas";
import { alterarStatusUsuario, redefinirSenha } from "@/modules/usuarios/usuarios.actions";
import type { CredenciaisGeradasDto, UsuarioAdminDto } from "@/modules/usuarios/usuarios.schemas";

import { FormularioUsuario } from "./formulario-usuario";
import { ModalSenhaGerada } from "./modal-senha-gerada";

type EstadoFormulario = { aberto: false } | { aberto: true; usuario: UsuarioAdminDto | null };
type Credenciais = { dados: CredenciaisGeradasDto; titulo: string };

type GerenciadorUsuariosProps = {
  usuarios: UsuarioAdminDto[];
  /** UTs ativas, para o select do formulário. */
  uts: UtDto[];
  busca: string;
  /** Id do admin logado: ele não pode desativar a si mesmo. */
  meuId: string | null;
};

export function GerenciadorUsuarios({ usuarios, uts, busca, meuId }: GerenciadorUsuariosProps) {
  const router = useRouter();
  const [formulario, setFormulario] = useState<EstadoFormulario>({ aberto: false });
  const [credenciais, setCredenciais] = useState<Credenciais | null>(null);
  const [paraRedefinir, setParaRedefinir] = useState<UsuarioAdminDto | null>(null);
  const [paraDesativar, setParaDesativar] = useState<UsuarioAdminDto | null>(null);
  const [processando, iniciar] = useTransition();

  function aoCriar(dados: CredenciaisGeradasDto) {
    setFormulario({ aberto: false });
    setCredenciais({ dados, titulo: "Usuário criado" });
    router.refresh();
  }

  function aoEditar(usuario: UsuarioAdminDto) {
    toast.success(`Dados de ${usuario.nome} salvos.`);
    setFormulario({ aberto: false });
    router.refresh();
  }

  function confirmarRedefinicao(usuario: UsuarioAdminDto) {
    iniciar(async () => {
      const resultado = await redefinirSenha({ id: usuario.id });
      setParaRedefinir(null);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      setCredenciais({ dados: resultado.dados, titulo: "Senha redefinida" });
      router.refresh();
    });
  }

  function alterarStatus(usuario: UsuarioAdminDto, ativo: boolean) {
    iniciar(async () => {
      const resultado = await alterarStatusUsuario({ id: usuario.id, ativo });
      setParaDesativar(null);
      if (!resultado.ok) {
        toast.error(resultado.erro);
        return;
      }
      toast.success(ativo ? "Usuário reativado." : "Usuário desativado.");
      router.refresh();
    });
  }

  const acoes = (usuario: UsuarioAdminDto) => (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Editar ${usuario.nome}`}
        onClick={() => setFormulario({ aberto: true, usuario })}
      >
        <Icone nome="edit" tamanho={20} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Redefinir a senha de ${usuario.nome}`}
        onClick={() => setParaRedefinir(usuario)}
        disabled={processando}
      >
        <Icone nome="key" tamanho={20} />
      </Button>
      {usuario.ativo ? (
        usuario.id === meuId ? null : (
          <Button variant="secondary" size="sm" onClick={() => setParaDesativar(usuario)} disabled={processando}>
            Desativar
          </Button>
        )
      ) : (
        <Button variant="secondary" size="sm" onClick={() => alterarStatus(usuario, true)} disabled={processando}>
          Reativar
        </Button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Form action="/administracao/usuarios" role="search" className="min-w-0 flex-1 basis-60 lg:max-w-md">
          <label htmlFor="busca-usuarios" className="sr-only">
            Buscar usuário
          </label>
          <div className="relative">
            <Icone
              nome="search"
              tamanho={20}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="busca-usuarios"
              type="search"
              name="q"
              defaultValue={busca}
              placeholder="Buscar por nome, e-mail, CPF ou UT"
              autoComplete="off"
              className="pl-10"
            />
          </div>
        </Form>

        <Button onClick={() => setFormulario({ aberto: true, usuario: null })}>
          <Icone nome="add" tamanho={20} />
          Novo usuário
        </Button>
      </div>

      {usuarios.length === 0 ? (
        <div className="rounded-md border border-border bg-card p-6 text-sm">
          {busca ? "Nenhum usuário encontrado para essa busca." : "Nenhum usuário cadastrado."}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {usuarios.length} {usuarios.length === 1 ? "usuário" : "usuários"}
          </p>

          {/* Desktop: tabela (DESIGN §6). */}
          <div className="hidden overflow-hidden rounded-md border border-border bg-card lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <th className="h-10 px-4 font-medium">Nome</th>
                  <th className="h-10 px-4 font-medium">CPF</th>
                  <th className="h-10 px-4 font-medium">Papel</th>
                  <th className="h-10 px-4 font-medium">UT</th>
                  <th className="h-10 px-4 font-medium">Status</th>
                  <th className="h-10 px-4 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="h-14 border-t border-border">
                    <td className="px-4">
                      <p className="font-medium">{usuario.nome}</p>
                      <p className="text-xs text-muted-foreground">{usuario.email}</p>
                    </td>
                    <td className="px-4 tabular-nums">{usuario.cpf}</td>
                    <td className="px-4">{ROTULO_PAPEL[usuario.papel]}</td>
                    <td className="px-4">
                      <p>{usuario.utRotulo ?? <span className="text-muted-foreground">Sem UT</span>}</p>
                      {usuario.utsAdicionais.length > 0 ? (
                        <p className="text-xs text-muted-foreground" title={usuario.utsAdicionais.map((ut) => ut.rotulo).join(", ")}>
                          {rotuloUtsAdicionais(usuario.utsAdicionais.length)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4">
                      <div className="flex flex-wrap gap-1">
                        {usuario.ativo ? null : <Selo>Inativo</Selo>}
                        {usuario.ativo && usuario.deveTrocarSenha ? <Selo variante="contorno">Senha provisória</Selo> : null}
                      </div>
                    </td>
                    <td className="px-4">
                      <div className="flex items-center justify-end gap-1">{acoes(usuario)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cada linha vira um card compacto (DESIGN §6). */}
          <ul className="flex flex-col gap-2 lg:hidden">
            {usuarios.map((usuario) => (
              <li key={usuario.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{usuario.nome}</p>
                    <p className="mt-0.5 text-xs break-all text-muted-foreground">{usuario.email}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {ROTULO_PAPEL[usuario.papel]} · {usuario.utRotulo ?? "Sem UT"}
                      {usuario.utsAdicionais.length > 0 ? ` ${rotuloUtsAdicionais(usuario.utsAdicionais.length)}` : null}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {usuario.ativo ? null : <Selo>Inativo</Selo>}
                    {usuario.ativo && usuario.deveTrocarSenha ? <Selo variante="contorno">Senha provisória</Selo> : null}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1">{acoes(usuario)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialogo
        aberto={formulario.aberto}
        aoMudar={(aberto) => !aberto && setFormulario({ aberto: false })}
        titulo={formulario.aberto && formulario.usuario ? "Editar usuário" : "Novo usuário"}
      >
        {formulario.aberto ? (
          <FormularioUsuario
            key={formulario.usuario?.id ?? "novo"}
            usuario={formulario.usuario}
            uts={uts}
            aoCriar={aoCriar}
            aoEditar={aoEditar}
            aoCancelar={() => setFormulario({ aberto: false })}
          />
        ) : null}
      </Dialogo>

      <ModalSenhaGerada
        credenciais={credenciais?.dados ?? null}
        titulo={credenciais?.titulo ?? ""}
        aoFechar={() => setCredenciais(null)}
      />

      <ConfirmarAcao
        aberto={paraRedefinir !== null}
        aoMudar={(aberto) => !aberto && setParaRedefinir(null)}
        titulo="Redefinir senha"
        consequencia={
          <>
            Uma nova senha provisória será gerada para <strong>{paraRedefinir?.nome}</strong>. A senha
            atual deixa de valer e as sessões abertas são encerradas.
          </>
        }
        rotuloConfirmar="Redefinir senha"
        processando={processando}
        aoConfirmar={() => paraRedefinir && confirmarRedefinicao(paraRedefinir)}
      />

      <ConfirmarAcao
        aberto={paraDesativar !== null}
        aoMudar={(aberto) => !aberto && setParaDesativar(null)}
        titulo="Desativar usuário"
        consequencia={
          <>
            <strong>{paraDesativar?.nome}</strong> não poderá mais entrar, e as sessões abertas são
            encerradas agora.
          </>
        }
        rotuloConfirmar="Desativar"
        destrutiva
        processando={processando}
        aoConfirmar={() => paraDesativar && alterarStatus(paraDesativar, false)}
      />
    </div>
  );
}

function rotuloUtsAdicionais(quantidade: number): string {
  return quantidade === 1 ? "+1 UT adicional" : `+${quantidade} UTs adicionais`;
}
