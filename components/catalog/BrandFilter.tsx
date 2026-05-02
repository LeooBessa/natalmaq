import Link from "next/link";

import type { Marca } from "@/types";
import { cn } from "@/lib/cn";

export function BrandFilter({
  marcas,
  selecionada,
}: {
  marcas: Marca[];
  selecionada?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/catalogo"
        className={cn(
          "rounded-full border px-3 py-1 text-sm transition",
          !selecionada
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-zinc-300 bg-white hover:border-brand-500 hover:text-brand-600",
        )}
      >
        Todas as marcas
      </Link>
      {marcas.map((m) => (
        <Link
          key={m.id}
          href={`/marca/${m.slug}`}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition",
            selecionada === m.slug
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-zinc-300 bg-white hover:border-brand-500 hover:text-brand-600",
          )}
        >
          {m.nome}
        </Link>
      ))}
    </div>
  );
}
