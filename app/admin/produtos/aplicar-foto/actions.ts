"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProdutoBusca = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  imagens: string[];
};

// Tira o que quebra a gramática do filtro .or() do PostgREST (vírgula/parênteses).
function limpar(q: string) {
  return q.replace(/[,()]/g, " ").trim();
}

export async function buscarProdutosParaFotoAction(
  q: string,
): Promise<ProdutoBusca[]> {
  const termo = limpar(q);
  if (termo.length < 2) return [];

  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("produtos")
    .select("id, codigo, nome, ativo, imagens")
    .or(`nome.ilike.%${termo}%,codigo.ilike.%${termo}%`)
    .order("nome")
    .limit(80);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    codigo: p.codigo as string,
    nome: p.nome as string,
    ativo: p.ativo as boolean,
    imagens: Array.isArray(p.imagens)
      ? (p.imagens as unknown[]).filter((u): u is string => typeof u === "string")
      : [],
  }));
}

export async function aplicarImagemEmLoteAction(
  url: string,
  ids: string[],
): Promise<{ count?: number; error?: string }> {
  if (!url) return { error: "Envie uma foto primeiro." };
  if (!ids.length) return { error: "Selecione ao menos um produto." };

  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.rpc("admin_aplicar_imagem", { ids, url });
  if (error) return { error: error.message };

  // A foto precisa aparecer na loja: revalida vitrine + admin.
  revalidatePath("/");
  revalidatePath("/catalogo");
  revalidatePath("/admin/produtos");
  return { count: typeof data === "number" ? data : ids.length };
}
