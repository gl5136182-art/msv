import type { MetadataRoute } from "next";

// Cores do manifest = laranja Manserv (DESIGN §9). Ícones gerados por `npm run icones:pwa`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MSV",
    short_name: "MSV",
    description: "Marketplace interno de itens da Manserv",
    lang: "pt-BR",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ff460a",
    theme_color: "#ff460a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
