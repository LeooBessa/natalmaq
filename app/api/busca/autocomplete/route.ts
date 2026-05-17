import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 1) {
    return NextResponse.json({ items: [] });
  }

  const sb = getSupabase();

  const { data, error } = await sb
    .from("produtos")
    .select("id, slug, nome, preco, preco_promocional, imagens")
    .eq("ativo", true)
    .ilike("nome", `%${q}%`)
    .limit(8);

  if (error) {
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
