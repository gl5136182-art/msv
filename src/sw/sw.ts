/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { CacheFirst, ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

// Service worker do MSV (CLAUDE.md, Stack): cache SOMENTE de assets estáticos.
// Páginas autenticadas, respostas de server actions, dados e fotos do Storage nunca passam
// pelo cache: qualquer requisição que não case com as regras abaixo vai direto à rede.
// Por isso NÃO usamos o `defaultCache` do Serwist (ele cacheia páginas, RSC e /api).
//
// Empacotado em public/sw.js por `npm run sw` (scripts/gerar-sw.mjs), antes do `next build`.

const serwist = new Serwist({
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      // JS, CSS e fontes com hash no nome (inclui as fontes do next/font): imutáveis.
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "msv-next-static",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      // Arquivos de public/: marca e ícones.
      matcher: ({ sameOrigin, url }) =>
        sameOrigin && (url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/")),
      handler: new StaleWhileRevalidate({
        cacheName: "msv-public",
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
  ],
});

serwist.addEventListeners();
