import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // --- Redução de custo de Image Optimization na Vercel ---
    // Imagens de produto praticamente não mudam — e quando trocam, a URL muda
    // (o upload gera nome único). Cache longo evita RE-transformar a mesma
    // imagem: era o padrão de 60s, agora 31 dias. É o maior ganho, sem perda.
    minimumCacheTTL: 2678400,
    // 1 formato só (já era o padrão) e 1 qualidade só (a padrão, 75). Deixar
    // explícito trava a quantidade de transformações por imagem.
    formats: ["image/webp"],
    qualities: [75],
    // Tira os tamanhos gigantes (2048 e 3840 = 4K), que a loja nunca exibe —
    // cada tamanho a menos é uma variação a menos gerada/armazenada por imagem.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  typedRoutes: false,
  experimental: {
    // PDFs do Delphi (importação de planilha) chegam em ~1.5MB.
    // PDFs de fornecedor (importar-fotos) sobem direto pro Storage,
    // bypassando esse limite.
    serverActions: { bodySizeLimit: "10mb" },
  },
  // pdfjs-dist é grande (37MB) mas decodifica JPEG2000 nativo. unpdf
  // não tem OpenJPEG WASM, então perde ~70% das fotos em catálogos
  // profissionais. .next/cache (226MB de webpack) é apagado no
  // buildCommand do vercel.json — sem isso o bundle estoura 250MB.
  serverExternalPackages: ["pdfjs-dist", "pngjs", "@react-pdf/renderer"],
  // Garante que a logo usada no PDF do pedido seja incluída no bundle da
  // função serverless (lida via fs em runtime na rota /admin/pedidos/[id]/pdf).
  outputFileTracingIncludes: {
    "/admin/pedidos/[id]/pdf": ["./public/brand/natalmaq-lockup.png"],
  },
  outputFileTracingExcludes: {
    "*": [
      ".next/cache/**",
      ".tmp/**",
      "scripts/**",
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
