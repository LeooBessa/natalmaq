import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Edge runtime: cold start ~0. A versão Node serverless levava ~8s na 1ª busca.
export const runtime = "edge";

type Sugestao = {
  id: string;
  slug: string;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  imagens: unknown;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const sb = getSupabase();

  // Mesma busca ranqueada dos resultados do catálogo (migration 0034):
  // entende abreviação (parafuso -> PARAF), prefixo (typeahead) e ordena por
  // relevância — base antes das variantes (s/c, c/chata…).
  const { data } = await sb.rpc("buscar_produtos_rank", { termo: q, lim: 8, off: 0 });

  const items: Sugestao[] = ((data ?? []) as Array<Record<string, unknown>>).map((p) => ({
    id: p.id as string,
    slug: p.slug as string,
    nome: p.nome as string,
    preco: p.preco as number,
    preco_promocional: (p.preco_promocional as number | null) ?? null,
    imagens: p.imagens,
  }));

  return NextResponse.json(
    { items },
    {
      // Cache no CDN da Vercel: query repetida volta instantânea. Catálogo muda
      // pouco; stale-while-revalidate mantém fresco em 2º plano.
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
