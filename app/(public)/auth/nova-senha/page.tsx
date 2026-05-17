"use client";

import { useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function NovaSenhaPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) { setPronto(true); return; }

    const params = new URLSearchParams(hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");

    if (type === "recovery" && access_token && refresh_token) {
      const sb = createSupabaseBrowserClient();
      sb.auth.setSession({ access_token, refresh_token }).then(() => {
        window.history.replaceState(null, "", window.location.pathname);
        setPronto(true);
      });
    } else {
      setPronto(true);
    }
  }, []);

  if (!pronto) return null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const senha = fd.get("senha") as string;
    const confirmar = fd.get("confirmar") as string;

    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.auth.updateUser({ password: senha });
      if (error) {
        setErro("Não foi possível redefinir a senha. O link pode ter expirado.");
      } else {
        setSucesso(true);
        setTimeout(() => router.push("/minha-conta"), 2500);
      }
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
          {sucesso ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
                ✅
              </div>
              <h2 className="font-semibold text-zinc-900">Senha redefinida!</h2>
              <p className="text-sm text-zinc-500">
                Sua senha foi atualizada. Redirecionando para sua conta…
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="font-display text-[22px] tracking-tight text-ink">
                  Nova senha
                </h1>
                <p className="mt-1 text-sm text-ink-2">
                  Escolha uma senha segura para sua conta.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Nova senha
                  </label>
                  <input
                    name="senha"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Mín. 6 caracteres"
                    className="w-full rounded border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Confirmar nova senha
                  </label>
                  <input
                    name="confirmar"
                    type="password"
                    required
                    autoComplete="new-password"
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
                  {pending ? "Salvando…" : "Salvar nova senha"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
