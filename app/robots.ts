import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

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
