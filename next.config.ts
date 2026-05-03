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
  // Reduz o tamanho da função serverless: pdfjs-dist tem 37MB de assets
  // (cmaps, fonts, builds duplicados) que não usamos. Sem isso o bundle
  // estoura o limite de 250MB da Vercel.
  outputFileTracingExcludes: {
    "*": [
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
