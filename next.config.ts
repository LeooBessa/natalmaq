import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  typedRoutes: true,
  experimental: {
    // PDFs do Delphi (importação de planilha) chegam em ~1.5MB.
    // PDFs de fornecedor (importar-fotos) sobem direto pro Storage,
    // bypassando esse limite.
    serverActions: { bodySizeLimit: "10mb" },
  },
  // pdfjs-dist é grande (37MB). Externaliza no webpack pra não duplicar
  // (lazy-load no runtime via require), e exclui assets não usados do trace.
  serverExternalPackages: ["pdfjs-dist", "pngjs"],
  outputFileTracingExcludes: {
    "*": [
      // Cache do webpack (até 225MB!) — não deve ir no bundle de runtime
      ".next/cache/**",
      // Diretórios de teste/dev local
      ".tmp/**",
      "scripts/**",
      // pdfjs-dist: 37MB de assets (cmaps, fonts, builds duplicados) não usados
      "node_modules/pdfjs-dist/build/**",
      "node_modules/pdfjs-dist/cmaps/**",
      "node_modules/pdfjs-dist/standard_fonts/**",
      "node_modules/pdfjs-dist/web/**",
      "node_modules/pdfjs-dist/image_decoders/**",
      "node_modules/pdfjs-dist/types/**",
      "node_modules/@types/**",
      "node_modules/typescript/**",
      "node_modules/.cache/**",
      "node_modules/**/*.md",
      "node_modules/**/*.map",
      "node_modules/**/test/**",
      "node_modules/**/tests/**",
      "node_modules/**/__tests__/**",
    ],
  },
  // Em dev: FastAPI roda separado em :8000.
  // Em prod (Vercel): vercel.json faz o rewrite para /api/index.py.
  async rewrites() {
    if (!isDev) return [];
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
