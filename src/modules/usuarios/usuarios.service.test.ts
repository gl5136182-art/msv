import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErroNegocio } from "@/lib/erro-negocio";

vi.mock("@/infra/auth", () => ({ entrarComEmailESenha: vi.fn(), trocarSenhaDaSessao: vi.fn() }));
vi.mock("./usuarios.repository", () => ({
  buscarLoginPorCpf: vi.fn(),
  buscarLoginPorEmail: vi.fn(),
  marcarSenhaComoTrocada: vi.fn(),
}));

import { entrarComEmailESenha, trocarSenhaDaSessao } from "@/infra/auth";
import type { UsuarioLogado } from "@/lib/usuario-logado";

import * as repository from "./usuarios.repository";
import { entrar, trocarSenha } from "./usuarios.service";

const cabecalhos = new Headers({ "x-forwarded-for": "10.0.0.1" });
const EMAIL_INEXISTENTE = "usuario-inexistente@msv.invalid";

const autenticar = vi.mocked(entrarComEmailESenha);
const buscarPorCpf = vi.mocked(repository.buscarLoginPorCpf);
const buscarPorEmail = vi.mocked(repository.buscarLoginPorEmail);
const trocarNaSessao = vi.mocked(trocarSenhaDaSessao);
const marcarTrocada = vi.mocked(repository.marcarSenhaComoTrocada);

beforeEach(() => {
  vi.resetAllMocks();
  autenticar.mockResolvedValue("ok");
});

describe("entrar: identificação do usuário", () => {
  it("CPF com máscara: busca pelos dígitos e autentica com o e-mail encontrado", async () => {
    buscarPorCpf.mockResolvedValue({ email: "maria@manserv.com.br", ativo: true });

    await entrar({ identificador: "529.982.247-25", senha: "segredo123" }, { cabecalhos });

    expect(buscarPorCpf).toHaveBeenCalledWith("52998224725");
    expect(buscarPorEmail).not.toHaveBeenCalled();
    expect(autenticar).toHaveBeenCalledWith({
      email: "maria@manserv.com.br",
      senha: "segredo123",
      cabecalhos,
    });
  });

  it("e-mail: normaliza para minúsculas e não consulta por CPF", async () => {
    buscarPorEmail.mockResolvedValue({ email: "maria@manserv.com.br", ativo: true });

    await entrar({ identificador: "  Maria@Manserv.com.br ", senha: "segredo123" }, { cabecalhos });

    expect(buscarPorEmail).toHaveBeenCalledWith("maria@manserv.com.br");
    expect(buscarPorCpf).not.toHaveBeenCalled();
  });

  it("CPF com dígitos verificadores inválidos: nem consulta o banco", async () => {
    autenticar.mockResolvedValue("invalido");

    await expect(
      entrar({ identificador: "111.111.111-11", senha: "x" }, { cabecalhos }),
    ).rejects.toThrow("E-mail/CPF ou senha inválidos.");

    expect(buscarPorCpf).not.toHaveBeenCalled();
    expect(autenticar).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL_INEXISTENTE }));
  });

  it("CPF não cadastrado: segue o login com e-mail inexistente (mesma resposta e mesmo trabalho)", async () => {
    buscarPorCpf.mockResolvedValue(null);
    autenticar.mockResolvedValue("invalido");

    await expect(
      entrar({ identificador: "52998224725", senha: "x" }, { cabecalhos }),
    ).rejects.toMatchObject({ codigo: "CREDENCIAIS_INVALIDAS" });

    expect(autenticar).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL_INEXISTENTE }));
  });

  it("usuário inativo: nunca autentica com o e-mail real", async () => {
    buscarPorCpf.mockResolvedValue({ email: "maria@manserv.com.br", ativo: false });
    autenticar.mockResolvedValue("invalido");

    await expect(
      entrar({ identificador: "52998224725", senha: "segredo123" }, { cabecalhos }),
    ).rejects.toMatchObject({ codigo: "CREDENCIAIS_INVALIDAS" });

    expect(autenticar).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL_INEXISTENTE }));
  });
});

describe("entrar: resultado da autenticação", () => {
  it("senha errada: mensagem genérica, a mesma de CPF inexistente", async () => {
    buscarPorEmail.mockResolvedValue({ email: "maria@manserv.com.br", ativo: true });
    autenticar.mockResolvedValue("invalido");

    const erro = await entrar({ identificador: "maria@manserv.com.br", senha: "errada" }, { cabecalhos }).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroNegocio);
    expect((erro as ErroNegocio).message).toBe("E-mail/CPF ou senha inválidos.");
  });

  it("limite de tentativas: mensagem própria, para o usuário esperar", async () => {
    buscarPorEmail.mockResolvedValue({ email: "maria@manserv.com.br", ativo: true });
    autenticar.mockResolvedValue("limite");

    await expect(
      entrar({ identificador: "maria@manserv.com.br", senha: "x" }, { cabecalhos }),
    ).rejects.toMatchObject({ codigo: "LIMITE_DE_TENTATIVAS" });
  });

  it("sucesso: não lança", async () => {
    buscarPorEmail.mockResolvedValue({ email: "maria@manserv.com.br", ativo: true });
    await expect(
      entrar({ identificador: "maria@manserv.com.br", senha: "segredo123" }, { cabecalhos }),
    ).resolves.toBeUndefined();
  });
});

describe("trocarSenha", () => {
  const usuario: UsuarioLogado = {
    id: "u1",
    nome: "Maria Souza",
    email: "maria@manserv.com.br",
    papel: "colaborador",
    utId: "ut1",
    ativo: true,
    deveTrocarSenha: true,
  };
  const entrada = { senhaAtual: "Antiga#123", novaSenha: "Nova#12345", confirmacao: "Nova#12345" };

  it("troca a senha e tira a obrigatoriedade de troca", async () => {
    trocarNaSessao.mockResolvedValue("ok");

    await trocarSenha(usuario, entrada, { cabecalhos });

    expect(trocarNaSessao).toHaveBeenCalledWith({
      senhaAtual: "Antiga#123",
      novaSenha: "Nova#12345",
      cabecalhos,
    });
    expect(marcarTrocada).toHaveBeenCalledWith("u1");
  });

  it("troca voluntária (deve_trocar_senha já é false): não mexe na flag", async () => {
    trocarNaSessao.mockResolvedValue("ok");

    await trocarSenha({ ...usuario, deveTrocarSenha: false }, entrada, { cabecalhos });

    expect(marcarTrocada).not.toHaveBeenCalled();
  });

  it("senha atual errada: mensagem própria e a flag continua valendo", async () => {
    trocarNaSessao.mockResolvedValue("senha_atual_invalida");

    await expect(trocarSenha(usuario, entrada, { cabecalhos })).rejects.toMatchObject({
      codigo: "SENHA_ATUAL_INVALIDA",
      message: "A senha atual está incorreta.",
    });
    expect(marcarTrocada).not.toHaveBeenCalled();
  });

  it("usuário inativo não troca a senha", async () => {
    await expect(trocarSenha({ ...usuario, ativo: false }, entrada, { cabecalhos })).rejects.toMatchObject({
      codigo: "USUARIO_INATIVO",
    });
    expect(trocarNaSessao).not.toHaveBeenCalled();
  });
});
