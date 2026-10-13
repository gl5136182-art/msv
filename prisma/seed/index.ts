// Seed base (Fase 1, SPEC §6.0): categorias aprovadas, UTs de prisma/seed/uts.csv e o primeiro
// admin, com dados do .env. Pode rodar quantas vezes for preciso (idempotente):
//   - categorias e UTs: upsert (UT pelo código; nome, cidade e UF seguem o CSV, o status não muda);
//   - admin: criado só se ainda não existir; a senha de um admin existente nunca é alterada.
// Falha com erro claro se alguma linha do CSV estiver sem cidade ou UF, ou se faltar variável.

import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { generateRandomString, hashPassword } from "better-auth/crypto";

import { db } from "@/infra/db";
import { cpfValido, limparCpf } from "@/lib/cpf";

import { lerUtsDoCsv } from "./uts-csv";

const CATEGORIAS_APROVADAS = [
  "Ferramentas manuais",
  "Ferramentas elétricas",
  "EPI",
  "Elétrica",
  "Hidráulica",
  "Mecânica e peças",
  "Informática",
  "Mobiliário",
  "Escritório",
  "Limpeza",
  "Equipamentos de medição",
  "Outros",
];

const SENHA_TAMANHO_MINIMO = 8;

async function semearCategorias(): Promise<void> {
  for (const nome of CATEGORIAS_APROVADAS) {
    await db.categoria.upsert({ where: { nome }, update: {}, create: { nome } });
  }
  console.log(`seed: ${CATEGORIAS_APROVADAS.length} categorias garantidas.`);
}

async function semearUts(): Promise<void> {
  const caminho = join(process.cwd(), "prisma", "seed", "uts.csv");
  const { uts, erros } = lerUtsDoCsv(readFileSync(caminho, "utf8"));

  if (erros.length > 0) {
    throw new Error(`Corrija prisma/seed/uts.csv antes de rodar o seed:\n  - ${erros.join("\n  - ")}`);
  }

  for (const ut of uts) {
    await db.ut.upsert({
      where: { codigo: ut.codigo },
      update: { nome: ut.nome, cidade: ut.cidade, uf: ut.uf },
      create: ut,
    });
  }
  console.log(`seed: ${uts.length} UTs garantidas (upsert pelo código).`);
}

async function semearAdmin(): Promise<void> {
  const nome = process.env.SEED_ADMIN_NOME?.trim();
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const cpfInformado = process.env.SEED_ADMIN_CPF?.trim();
  const senha = process.env.SEED_ADMIN_SENHA;

  const faltando = [
    ["SEED_ADMIN_NOME", nome],
    ["SEED_ADMIN_EMAIL", email],
    ["SEED_ADMIN_CPF", cpfInformado],
    ["SEED_ADMIN_SENHA", senha],
  ]
    .filter(([, valor]) => !valor)
    .map(([variavel]) => variavel);

  if (faltando.length > 0) {
    throw new Error(`Defina no .env para criar o primeiro admin: ${faltando.join(", ")}.`);
  }
  if (!cpfValido(cpfInformado!)) {
    throw new Error("SEED_ADMIN_CPF não é um CPF válido.");
  }
  if (senha!.length < SENHA_TAMANHO_MINIMO) {
    throw new Error(`SEED_ADMIN_SENHA deve ter no mínimo ${SENHA_TAMANHO_MINIMO} caracteres.`);
  }
  const cpf = limparCpf(cpfInformado!);

  const existente = await db.usuario.findFirst({
    where: { OR: [{ email: email! }, { cpf }] },
    select: { email: true, cpf: true, papel: true },
  });
  if (existente) {
    if (existente.email !== email || existente.cpf !== cpf) {
      throw new Error(
        "Já existe um usuário com este e-mail ou este CPF, mas não são os dois do admin do .env. Confira SEED_ADMIN_EMAIL e SEED_ADMIN_CPF.",
      );
    }
    console.log("seed: admin já existe, nada a fazer (a senha não é alterada).");
    return;
  }

  const id = generateRandomString(32, "a-z", "A-Z", "0-9");
  const hash = await hashPassword(senha!);

  await db.$transaction(async (tx) => {
    await tx.usuario.create({
      data: { id, name: nome!, email: email!, cpf, papel: "admin", utId: null },
    });
    await tx.account.create({
      data: {
        id: generateRandomString(32, "a-z", "A-Z", "0-9"),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: hash,
      },
    });
  });
  // Sem CPF nem senha no log (LGPD).
  console.log(`seed: admin criado (${email}). A troca de senha será exigida no primeiro acesso.`);
}

async function semear(): Promise<void> {
  await semearCategorias();
  await semearUts();
  await semearAdmin();
}

semear()
  .then(() => db.$disconnect())
  .catch(async (erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : erro);
    await db.$disconnect();
    process.exit(1);
  });
