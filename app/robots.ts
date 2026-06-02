import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://natalmaq-main.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Áreas privadas/sem valor de indexação
      disallow: ["/admin", "/minha-conta", "/checkout", "/carrinho", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
