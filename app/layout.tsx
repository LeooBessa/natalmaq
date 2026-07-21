import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { AuthHashHandler } from "@/components/auth/AuthHashHandler";
import { organizationNode, storeNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

import { SITE_URL } from "@/lib/site-url";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Natalmaq — Máquinas, Ferramentas, Equipamentos e EPI's",
    template: "%s | Natalmaq",
  },
  description:
    "Catálogo industrial completo. Orçamentos rápidos via WhatsApp e entrega em todo o RN. Mais de 1.600 SKUs em estoque.",
  icons: {
    icon: "/brand/natalmaq-mark.png",
    apple: "/brand/natalmaq-mark.png",
  },
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
      {/* overflow-x-clip (e não -hidden): impede scroll horizontal sem virar
          um scroll container — o que quebraria o header sticky. */}
      <body className="min-h-screen overflow-x-clip bg-bone font-sans text-ink antialiased">
        <JsonLd data={[organizationNode(), storeNode()]} />
        <AuthHashHandler />
        {children}
      </body>
    </html>
  );
}
