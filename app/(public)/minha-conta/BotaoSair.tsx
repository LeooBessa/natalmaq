"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function BotaoSair() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSair() {
    startTransition(async () => {
      const sb = createSupabaseBrowserClient();
      // signOut no cliente: limpa localStorage E dispara onAuthStateChange
      // (o UserNavBar escuta e volta pra "Entrar" sem precisar F5).
      await sb.auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleSair}
      disabled={pending}
      className="font-mono text-[11px] uppercase tracking-mono text-ink-2 hover:text-ink disabled:opacity-50"
    >
      {pending ? "Saindo..." : "Sair →"}
    </button>
  );
}
