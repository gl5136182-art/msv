import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem Docker enxuta (Dockerfile). Na Vercel a opção é ignorada.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      // SVGs da marca viram componentes React só com `?svgr` (DESIGN §9): a cor vem do CSS via currentColor.
      "*.svg": {
        condition: { query: /[?&]svgr(?=&|$)/ },
        loaders: [{ loader: "@svgr/webpack", options: { svgo: false } }],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
