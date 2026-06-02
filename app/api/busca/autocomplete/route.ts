import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Edge runtime: cold start ~0. A versão Node serverless levava ~8s na 1ª busca.
export const runtime = "edge";

const COLS = "id, slug, nome, preco, preco_promocional, imagens";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Monta um tsquery de PREFIXO com AND a partir do que o usuário digitou:
 *   "furadeira bosch" -> "furadeira:* & bosch:*"
 * - tira acentos (NFD) p/ casar com busca_tsv, que é gerado com immutable_unaccent;
 * - mantém só palavras alfanuméricas (evita quebrar a sintaxe do tsquery);
 * - cada palavra é prefixo (:*) p/ casar enquanto o usuário ainda digita.
 * Retorna "" se não sobrar nenhuma palavra utilizável.
 */
function montarTsQuery(q: string): string {
  const limpo = q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const palavras = limpo.match(/[a-z0-9]+/g) ?? [];
  return palavras.map((w) => `${w}:*`).join(" & ");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const sb = getSupabase();

  // 1) Full-text no busca_tsv (nome[A] + descricao[B], acento-insensível).
  //    Multi-palavra em qualquer ordem, prefixo enquanto digita, ranqueável.
  let items: unknown[] = [];
  const tsq = montarTsQuery(q);
  if (tsq) {
    const { data } = await sb
      .from("produtos")
      .select(COLS)
      .eq("ativo", true)
      .textSearch("busca_tsv", tsq, { config: "portuguese" })
      .order("destaque", { ascending: false })
      .limit(8);
    items = data ?? [];
  }

  // 2) Fallback substring (índice trigram): garante que nunca volte MENOS que
  //    antes — pega casos que o full-text não cobre (ex.: pedaços de código).
  if (items.length === 0) {
    const { data, error } = await sb
      .from("produtos")
      .select(COLS)
      .eq("ativo", true)
      .ilike("nome", `%${q}%`)
      .limit(8);
    if (error) {
      return NextResponse.json({ items: [] }, { status: 500 });
    }
    items = data ?? [];
  }

  return NextResponse.json(
    { items },
    {
      // Cache no CDN da Vercel: query repetida volta instantânea, sem tocar a
      // função/Supabase. Catálogo muda pouco; SWR mantém fresco em 2º plano.
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    },
  );
}
