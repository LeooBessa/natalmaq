// Fonte única da URL pública do site.
//
// Antes isso estava duplicado em 6 arquivos (layout, robots, sitemap, seo,
// auth/actions, AuthTabs), cada um com o domínio antigo hardcoded no fallback
// e usando `process.env.X ?? padrao` — que NÃO cai no fallback quando a env
// existe mas está vazia (`??` só trata null/undefined). Uma env vazia gerava
// SITE_URL = "" e, no layout, `new URL("")` derruba o build.
//
// Importa para o Auth: a URL usada em `redirectTo` precisa bater com a
// allowlist de "Redirect URLs" do Supabase, senão ele descarta e usa a
// Site URL dele — foi o que quebrou a recuperação de senha na troca de domínio.

const DOMINIO_PADRAO = "https://natalmaqferramentas.com.br";

function normalizar(valor: string | undefined | null): string | null {
  const v = valor?.trim().replace(/\/+$/, "");
  if (!v) return null; // "" e undefined caem no fallback
  return /^https?:\/\//.test(v) ? v : `https://${v}`;
}

export const SITE_URL =
  normalizar(process.env.NEXT_PUBLIC_SITE_URL) ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : DOMINIO_PADRAO);
