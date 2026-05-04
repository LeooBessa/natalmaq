"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CartItem } from "@/types";

export async function syncCartAction(itens: CartItem[]): Promise<void> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;

  await sb.from("carrinho_itens").delete().eq("cliente_id", user.id);

  if (itens.length === 0) return;

  await sb.from("carrinho_itens").insert(
    itens.map((i) => ({
      cliente_id: user.id,
      produto_id: i.produto_id,
      codigo: i.codigo,
      slug: i.slug,
      nome: i.nome,
      imagem: i.imagem,
      preco_unit: i.preco_unit,
      quantidade: i.quantidade,
      estoque: i.estoque,
      peso_kg: i.peso_kg,
    })),
  );
}

export async function loadCartAction(): Promise<CartItem[] | null> {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .from("carrinho_itens")
    .select(
      "produto_id,codigo,slug,nome,imagem,preco_unit,quantidade,estoque,peso_kg",
    )
    .eq("cliente_id", user.id);

  if (!data || data.length === 0) return [];

  return data.map((r) => ({
    produto_id: r.produto_id,
    codigo: r.codigo,
    slug: r.slug,
    nome: r.nome,
    imagem: r.imagem,
    preco_unit: Number(r.preco_unit),
    quantidade: r.quantidade,
    estoque: r.estoque,
    peso_kg: Number(r.peso_kg),
  }));
}
