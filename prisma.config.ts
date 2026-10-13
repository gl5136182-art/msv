import "dotenv/config";
import { defineConfig } from "prisma/config";

// A CLI do Prisma (migrate, db pull, validate) usa a conexão DIRETA do Supabase.
// O runtime da aplicação usa o pooler (DATABASE_URL) via adapter em src/infra/db.ts.
// Sem `env()` de propósito: `prisma generate` não precisa de banco e não deve falhar sem .env.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
