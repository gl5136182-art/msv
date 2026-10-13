// Empacota src/sw/sw.ts em public/sw.js (service worker do PWA).
// Roda antes do `next build` (script `build`). Não depende de nada em tempo de execução:
// funciona igual na Vercel e no Docker `standalone`.
// Uso: npm run sw
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [path.join(raiz, "src/sw/sw.ts")],
  outfile: path.join(raiz, "public/sw.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});
