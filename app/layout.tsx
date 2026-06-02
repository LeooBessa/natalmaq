import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { AuthHashHandler } from "@/components/auth/AuthHashHandler";
import { LOJA_ENDERECO } from "@/lib/loja";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://natalmaq-main.vercel.app";

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

// Schema sitewide: identifica a Natalmaq como loja física pro Google (SEO local).
const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Natalmaq",
  description:
    "Loja de máquinas, ferramentas, equipamentos e EPI's em Natal/RN.",
  url: SITE_URL,
  telephone: "+55-84-3025-9789",
  image: `${SITE_URL}/brand/natalmaq-lockup.png`,
  address: {
    "@type": "PostalAddress",
    streetAddress: LOJA_ENDERECO.rua,
    addressLocality: LOJA_ENDERECO.cidade,
    addressRegion: LOJA_ENDERECO.uf,
    postalCode: LOJA_ENDERECO.cep,
    addressCountry: "BR",
  },
  openingHours: ["Mo-Fr 07:00-18:00", "Sa 07:00-12:00"],
  areaServed: "Rio Grande do Norte",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }}
        />
        <AuthHashHandler />
        {children}
      </body>
    </html>
  );
}
