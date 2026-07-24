import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_TIMEOUT_MS = 4000;

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Renova a sessão Supabase por cookie a cada request e protege /admin/*.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca a sessão (se houver) — IMPORTANTE para tokens em cookies HTTP-only.
  // getUser() faz uma chamada de rede ao Supabase Auth; sem um teto, um Auth
  // lento travaria o middleware até o 504 da Vercel. Cortamos em 4s e tratamos
  // como "sem sessão" — em rota protegida isso manda pro login (fail-closed).
  let user: User | null = null;
  try {
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("auth timeout")), AUTH_TIMEOUT_MS),
      ),
    ]);
    user = data.user;
  } catch {
    // Auth lento/indisponível: segue como não autenticado.
  }

  const path = request.nextUrl.pathname;
  const isAdminRoute = path.startsWith("/admin") && path !== "/admin/login";
  const isAdminLogin = path === "/admin/login";
  const isClientProtected =
    path === "/checkout" || path.startsWith("/minha-conta");

  // Admin: redireciona para /admin/login se não autenticado
  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (isAdminLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Público protegido: redireciona para /auth se não autenticado
  if (isClientProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}
