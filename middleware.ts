import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Só roda nas rotas que realmente precisam de sessão. Antes rodava em TODAS
  // as páginas (home, catálogo, cada produto...), e cada acesso — inclusive de
  // robôs — fazia uma chamada de rede ao Supabase Auth; sob carga isso estourava
  // o tempo do middleware e gerava 504. As páginas públicas não usam `user`
  // aqui, então ficam de fora.
  matcher: [
    "/admin",
    "/admin/:path*",
    "/minha-conta",
    "/minha-conta/:path*",
    "/checkout",
  ],
};
