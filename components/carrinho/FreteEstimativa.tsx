"use client";

import { useState } from "react";

export function FreteEstimativa() {
  const [cep, setCep] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "erro">("idle");
  const [cidade, setCidade] = useState("");

  function formatCep(value: string) {
    return value.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
  }

  async function calcular() {
    const raw = cep.replace(/\D/g, "");
    if (raw.length !== 8) return;
    setStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = await res.json();
      if (data.erro) {
        setStatus("erro");
        return;
      }
      setCidade(`${data.localidade} — ${data.uf}`);
      setStatus("ok");
    } catch {
      setStatus("erro");
    }
  }

  return (
    <div className="mt-4 border-t border-white/15 pt-4">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-mono text-white/70">
        Calcular frete
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={cep}
          onChange={(e) => {
            setCep(formatCep(e.target.value));
            setStatus("idle");
          }}
          onKeyDown={(e) => e.key === "Enter" && calcular()}
          placeholder="00000-000"
          aria-label="CEP para cálculo de frete"
          maxLength={9}
          className="w-full border border-white/30 bg-transparent px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-white/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={calcular}
          disabled={status === "loading"}
          className="shrink-0 bg-white/10 px-4 font-mono text-[11px] uppercase tracking-mono text-white hover:bg-white/20 disabled:opacity-50"
        >
          {status === "loading" ? "..." : "OK"}
        </button>
      </div>

      {status === "ok" && (
        <div className="mt-2 text-[12px] text-white/80">
          <span className="text-ok">●</span>{" "}
          Entregamos em <span className="font-semibold">{cidade}</span>.
          Frete calculado no checkout.
        </div>
      )}
      {status === "erro" && (
        <div className="mt-2 text-[12px] text-brand-400">
          CEP não encontrado. Verifique e tente novamente.
        </div>
      )}
    </div>
  );
}
