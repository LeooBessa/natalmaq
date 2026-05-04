"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function UserNav() {
  const [nome, setNome] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();

    async function carregar() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setCarregando(false); return; }

      const { data } = await sb
        .from("clientes")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();

      setNome(data?.nome ?? user.email ?? "Minha conta");
      setCarregando(false);
    }

    carregar();

    const { data: { subscription } } = sb.auth.onAuthStateChange(() => {
      carregar();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (carregando) return null;

  if (nome) {
    return (
      <Link
        href="/minha-conta"
        className="hover:text-white"
        title={nome}
      >
        {nome.split(" ")[0].toUpperCase()}
      </Link>
    );
  }

  return (
    <Link href="/auth" className="hover:text-white">
      ENTRAR
    </Link>
  );
}
