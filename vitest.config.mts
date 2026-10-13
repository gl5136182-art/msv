import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    // Os testes são dos services e utilitários puros (CLAUDE.md); enquanto não há nenhum, não falha.
    passWithNoTests: true,
  },
});
