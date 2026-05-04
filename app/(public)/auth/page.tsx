import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthTabs } from "./AuthTabs";

export const dynamic = "force-dynamic";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; next?: string; erro?: string }>;
}) {
  const { tab, next, erro } = await searchParams;

  // Já logado → redireciona para destino ou minha-conta
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect(next ?? "/minha-conta");

  const defaultTab = tab === "cadastro" ? "cadastro" : "entrar";
  const nextUrl = next ?? "/minha-conta";

  return (
    <div className="min-h-[80vh] bg-bone">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center px-4 py-16">
        {/* Brand */}
        <Link href="/" className="mb-8 block">
          <span className="font-display text-[28px] tracking-tight text-ink">
            NATAL<span className="text-brand-500">MAQ</span>
          </span>
        </Link>

        <div className="w-full max-w-[520px] rounded-lg border border-line bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="font-display text-[22px] tracking-tight text-ink">
              {defaultTab === "entrar" ? "Acesse sua conta" : "Crie sua conta"}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              {defaultTab === "entrar"
                ? "Para continuar, entre com seu e-mail e senha."
                : "Cadastre-se para agilizar seus próximos orçamentos."}
            </p>
          </div>

          {erro === "link_invalido" && (
            <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              Link inválido ou expirado. Solicite um novo.
            </p>
          )}

          <AuthTabs defaultTab={defaultTab} next={nextUrl} />
        </div>
      </div>
    </div>
  );
}
