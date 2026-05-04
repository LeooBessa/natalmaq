"use client";

import { logoutClienteAction } from "@/app/(public)/auth/actions";

export function BotaoSair() {
  return (
    <button
      onClick={() => logoutClienteAction()}
      className="font-mono text-[11px] uppercase tracking-mono text-ink-2 hover:text-ink"
    >
      Sair →
    </button>
  );
}
