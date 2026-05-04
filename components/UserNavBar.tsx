"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UserNavBar() {
  const [nome, setNome] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();

    async function carregar() {
      try {
        // getSession é local (sem rede) — mais confiável para mostrar estado
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.user) {
          setNome(null);
          setCarregando(false);
          return;
        }
        const { data } = await sb
          .from("clientes")
          .select("nome")
          .eq("id", session.user.id)
          .maybeSingle();
        setNome(data?.nome ?? session.user.email ?? "Minha conta");
      } catch {
        setNome(null);
      } finally {
        setCarregando(false);
      }
    }

    carregar();

    const { data: { subscription } } = sb.auth.onAuthStateChange(() => {
      setCarregando(true);
      carregar();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (carregando) return null;

  if (nome) {
    return (
      <Link
        href="/minha-conta"
        className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-mono text-ink hover:border-navy hover:text-navy"
        title="Minha conta"
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-ok" />
        <span className="hidden md:inline">{nome.split(" ")[0]}</span>
        <span className="hidden md:inline text-ink-2 font-normal normal-case tracking-normal">· conta</span>
      </Link>
    );
  }

  return (
    <Link
      href="/auth"
      className="inline-flex items-center border border-navy bg-white px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-mono text-navy hover:bg-navy hover:text-white"
    >
      Entrar
    </Link>
  );
}
