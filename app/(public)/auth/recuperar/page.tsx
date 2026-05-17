"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const [pending, startTransition] = useTransition();
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    startTransition(async () => {
      const sb = createSupabaseBrowserClient();
      const redirectTo = `${location.origin}/auth/callback`;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) setErro("Erro ao enviar e-mail. Tente novamente.");
      else setEnviado(true);
    });
  }

  return (
    <div className="min-h-[80vh] bg-bone">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center px-4 py-16">
        <Link href="/" className="mb-8 block">
          <span className="font-display text-[28px] tracking-tight text-ink">
            NATAL<span className="text-brand-500">MAQ</span>
          </span>
        </Link>

        <div className="w-full max-w-[440px] rounded-lg border border-line bg-white p-8 shadow-sm">
          {enviado ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
                ✉️
              </div>
              <h2 className="font-semibold text-zinc-900">Verifique seu e-mail</h2>
              <p className="text-sm text-zinc-500">
                Se o e-mail estiver cadastrado, você receberá um link para
                redefinir sua senha em instantes.
              </p>
              <Link href="/auth" className="block text-sm text-brand-600 hover:underline">
                ← Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-display text-[22px] tracking-tight text-ink">
                  Recuperar senha
                </h1>
                <p className="mt-1 text-sm text-ink-2">
                  Digite seu e-mail e enviaremos um link para criar uma nova senha.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    E-mail
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full rounded border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {erro && (
                  <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full bg-brand-500 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-400 disabled:opacity-50"
                >
                  {pending ? "Enviando…" : "Enviar link de recuperação"}
                </button>

                <div className="text-center">
                  <Link href="/auth" className="text-sm text-zinc-500 hover:text-brand-600">
                    ← Voltar para o login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
