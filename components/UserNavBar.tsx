"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/neon-button";
import { cn } from "@/lib/cn";

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
        title="Minha conta"
        aria-label="Minha conta"
        className={cn(
          buttonVariants({ variant: "default", size: "lg" }),
          "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 border-2 border-navy bg-white px-0 font-mono text-[12px] font-bold uppercase tracking-mono text-navy hover:bg-bone hover:text-navy-800 md:w-auto md:px-10"
        )}
      >
        <span className="pointer-events-none absolute inset-x-0 inset-y-0 mx-auto block h-0.5 w-3/4 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-0 transition-all duration-500 ease-in-out group-hover:opacity-100" />
        <User className="h-5 w-5 shrink-0" strokeWidth={3} />
        <span className="hidden md:inline">{nome.split(" ")[0]}</span>
        <span className="pointer-events-none absolute inset-x-0 -bottom-px mx-auto block h-0.5 w-3/4 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-0 transition-all duration-500 ease-in-out group-hover:opacity-70" />
      </Link>
    );
  }

  return (
    <Link
      href="/auth"
      title="Entrar"
      aria-label="Entrar"
      className={cn(
        buttonVariants({ variant: "default", size: "lg" }),
        "inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 border-2 border-navy bg-white px-0 font-mono text-[12px] font-bold uppercase tracking-mono text-navy hover:bg-bone hover:text-navy-800 md:w-auto md:px-10"
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 inset-y-0 mx-auto block h-0.5 w-3/4 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-0 transition-all duration-500 ease-in-out group-hover:opacity-100" />
      <User className="h-5 w-5 shrink-0" strokeWidth={3} />
      <span className="hidden md:inline">Entrar</span>
      <span className="pointer-events-none absolute inset-x-0 -bottom-px mx-auto block h-0.5 w-3/4 bg-gradient-to-r from-transparent via-brand-500 to-transparent opacity-0 transition-all duration-500 ease-in-out group-hover:opacity-70" />
    </Link>
  );
}
