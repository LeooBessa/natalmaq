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
    // PDFs de fornecedor (Bosch, Makita, ...) chegam até ~25MB.
    // Default do Server Action é 1mb.
    serverActions: { bodySizeLimit: "50mb" },
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
