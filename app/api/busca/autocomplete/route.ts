import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Edge runtime: cold start ~0. A versão Node serverless levava ~8s na 1ª busca.
export const runtime = "edge";

const COLS = "id, slug, nome, preco, preco_promocional, imagens";

type Produto = { id: string } & Record<string, unknown>;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * tsquery de PREFIXO com AND a partir do que o usuário digitou:
 *   "furadeira bosch" -> "furadeira:* & bosch:*"
 * tira acentos (casa com busca_tsv, gerado via immutable_unaccent), mantém só
 * palavras alfanuméricas e prefixa cada uma (:*). "" se não sobrar palavra.
 */
function montarTsQuery(q: string): string {
  const limpo = q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const palavras = limpo.match(/[a-z0-9]+/g) ?? [];
  return palavras.map((w) => `${w}:*`).join(" & ");
}

/** Mescla as camadas na ordem de prioridade, dedup por id, corta no limite. */
function mesclar(camadas: Produto[][], limite = 8): Produto[] {
  const vistos = new Set<string>();
  const out: Produto[] = [];
  for (const camada of camadas) {
    for (const p of camada) {
      if (out.length >= limite) return out;
      if (p && !vistos.has(p.id)) {
        vistos.add(p.id);
        out.push(p);
      }
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const sb = getSupabase();
  const tsq = montarTsQuery(q);

  // 3 camadas em paralelo, ordenadas por relevância de PREFIXO (regra GERAL,
  // vale para qualquer termo):
  //   1) nome COMEÇA com o termo             -> prioridade máxima
  //   2) full-text (multi-palavra/acento/palavra-prefixo) -> abrangente e robusto
  //   3) nome CONTÉM o termo (qualquer pos.) -> "as outras opções", por último
  const [comeca, ft, contem] = await Promise.all([
    sb
      .from("produtos")
      .select(COLS)
      .eq("ativo", true)
      .ilike("nome", `${q}%`)
      .limit(8),
    tsq
      ? sb
          .from("produtos")
          .select(COLS)
          .eq("ativo", true)
          .textSearch("busca_tsv", tsq, { config: "portuguese" })
          .limit(8)
      : Promise.resolve({ data: [] as Produto[] }),
    sb
      .from("produtos")
      .select(COLS)
      .eq("ativo", true)
      .ilike("nome", `%${q}%`)
      .limit(8),
  ]);

  const items = mesclar([
    (comeca.data ?? []) as Produto[],
    (ft.data ?? []) as Produto[],
    (contem.data ?? []) as Produto[],
  ]);

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
