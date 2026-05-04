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
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        setCarregando(false);
        return;
      }
      const { data } = await sb
        .from("clientes")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();
      setNome(data?.nome ?? user.email ?? "Minha conta");
      setCarregando(false);
    }

    carregar();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(() => carregar());

    return () => subscription.unsubscribe();
  }, []);

  if (carregando) return null;

  if (nome) {
    return (
      <Link
        href="/minha-conta"
        className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-mono text-ink hover:text-brand-500"
        title={nome}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-ok" />
        <span className="hidden md:inline">{nome.split(" ")[0]}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/auth"
      className="font-mono text-[11px] font-bold uppercase tracking-mono text-ink hover:text-brand-500"
    >
      Entrar
    </Link>
  );
}
