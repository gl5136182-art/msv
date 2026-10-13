import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Camadas (CLAUDE.md, Arquitetura): app → actions → service → repository / infra.
// `no-restricted-imports` é uma única regra: o bloco mais específico SUBSTITUI o anterior,
// então cada bloco repete o que vale para o grupo (inclusive a regra do Supabase).

const supabase = {
  name: "@supabase/supabase-js",
  message: "O Supabase só pode ser importado em src/infra/storage.ts.",
};

const prisma = [
  { name: "@prisma/client", message: "Prisma só nos repositories (e nos services, para tipos/transações)." },
  { name: "@/infra/db", message: "A instância do banco só é usada pelos repositories e pelos services (transações)." },
];

const prismaGerado = {
  group: ["@/generated/prisma", "@/generated/prisma/**", "**/generated/prisma/**"],
  message: "O client do Prisma gerado só pode ser importado pelas camadas de dados (repository/service/infra).",
};

const repository = {
  group: ["**/*.repository", "**/*.repository.ts"],
  message: "Acesso a dados só pelo service. Telas e actions não importam repository.",
};

const aoLado = (message) => [{ group: ["next", "next/*"], message }];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma Client gerado (src/generated/prisma): não é código nosso.
    "src/generated/**",
    // Service worker empacotado (gerado por `npm run sw`).
    "public/sw.js",
  ]),

  // Vale para todo o código do app, exceto onde há bloco mais específico abaixo.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/infra/storage.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [supabase] }],
    },
  },

  // Telas e componentes: só UI e composição. Dados chegam por actions/services.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [supabase, ...prisma], patterns: [repository, prismaGerado] }],
    },
  },

  // Actions: sessão, validação (Zod) e chamada ao service. Sem Prisma nem repository.
  {
    files: ["src/modules/**/*.actions.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [supabase, ...prisma], patterns: [repository, prismaGerado] }],
    },
  },

  // Services: regra de negócio pura. Não conhecem o framework; recebem o usuário por parâmetro.
  {
    files: ["src/modules/**/*.service.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [supabase],
          patterns: aoLado("Services não importam next/* (cookies, headers, redirect). Receba o usuário como parâmetro."),
        },
      ],
    },
  },

  // infra/: integrações externas atrás de funções neutras. Não depende dos módulos de domínio.
  {
    files: ["src/infra/**/*.ts"],
    ignores: ["src/infra/storage.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [supabase],
          patterns: [{ group: ["@/modules/**", "**/modules/**"], message: "infra/ não importa modules/." }],
        },
      ],
    },
  },
  {
    files: ["src/infra/storage.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/modules/**", "**/modules/**"], message: "infra/ não importa modules/." }] },
      ],
    },
  },
]);

export default eslintConfig;
