import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "Natalmaq — Máquinas, Ferramentas, Equipamentos e EPI's",
    template: "%s | Natalmaq",
  },
  description:
    "Catálogo industrial completo. Orçamentos rápidos via WhatsApp e entrega em todo o RN. Mais de 1.600 SKUs em estoque.",
};

export const viewport: Viewport = {
  themeColor: "#0A1628",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${archivoBlack.variable} ${jetbrains.variable}`}
    >
      <body className="min-h-screen bg-bone font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
