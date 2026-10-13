import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { RegistrarSw } from "@/components/registrar-sw";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: "MSV", template: "%s · MSV" },
  description: "Marketplace interno de itens da Manserv",
};

// Barra de status do celular acompanha a barra superior laranja (DESIGN §9).
export const viewport: Viewport = {
  themeColor: "#ff460a",
  // Necessário para env(safe-area-inset-*) funcionar (navegação inferior no iOS).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-sm">
        {children}
        <RegistrarSw />
      </body>
    </html>
  );
}
