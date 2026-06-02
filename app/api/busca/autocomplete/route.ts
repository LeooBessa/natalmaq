import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Edge runtime: cold start ~0. A versão Node serverless levava ~8s na 1ª busca
// (função "acordando"); no edge isso some.
export const runtime = "edge";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  // < 2 chars é largo demais (e o cliente também só chama com 2+).
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const sb = getSupabase();

  // ilike "%q%" usa o índice trigram já existente (idx_produtos_nome_trgm,
  // gin_trgm_ops em produtos.nome) — não é scan sequencial.
  const { data, error } = await sb
    .from("produtos")
    .select("id, slug, nome, preco, preco_promocional, imagens")
    .eq("ativo", true)
    .ilike("nome", `%${q}%`)
    .limit(8);

  if (error) {
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  return NextResponse.json(
    { items: data ?? [] },
    {
      // Cache no CDN da Vercel: a mesma query (ex.: "furadeira") volta
      // instantânea e não bate na função/Supabase. O catálogo muda pouco;
      // stale-while-revalidate mantém a resposta fresca em segundo plano.
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
