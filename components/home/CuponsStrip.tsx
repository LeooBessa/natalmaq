import type { CupomHome } from "@/types";

export function CuponsStrip({ cupons }: { cupons: CupomHome[] }) {
  if (cupons.length === 0) return null;

  return (
    <div className="overflow-hidden bg-brand-500 py-2">
      <div className="flex animate-marquee gap-0 whitespace-nowrap">
        {[...cupons, ...cupons].map((c, i) => (
          <span key={i} className="inline-flex items-center gap-3 px-8">
            <span className="font-mono text-[11px] font-bold uppercase tracking-mono text-white">
              {c.tipo === "percentual" ? `${c.valor}% OFF` : `R$${c.valor} OFF`}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-mono text-white/80">
              {c.descricao ?? `com o cupom`}
            </span>
            <span className="border border-white/50 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-mono text-white">
              {c.codigo}
            </span>
            <span className="mx-2 text-white/40">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
