import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";

/** Client do Prisma ou o client de uma transação: todo repository aceita um destes (CLAUDE.md). */
export type ClienteDb = PrismaClient | Prisma.TransactionClient;

// Instância única do Prisma. Só os repositories importam daqui (CLAUDE.md, Arquitetura).
// Runtime usa o pooler do Supabase (DATABASE_URL); as migrations usam DIRECT_URL (prisma.config.ts).

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criarClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não definida. Veja .env.example.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Criado sob demanda: importar este módulo não exige banco (ex.: `next build` sem .env).
// Em desenvolvimento o client fica no globalThis para sobreviver ao hot reload.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_alvo, propriedade) {
    const client = (globalParaPrisma.prisma ??= criarClient());
    const valor = Reflect.get(client, propriedade, client);
    return typeof valor === "function" ? valor.bind(client) : valor;
  },
});
