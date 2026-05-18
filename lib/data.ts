import "server-only";

import { createClient } from "@supabase/supabase-js";

import type {
  Banner,
  Categoria,
  CupomHome,
  Marca,
  ProdutoComMarca,
} from "@/types";

const PRODUTO_SELECT = `
  id, codigo, slug, nome, descricao, marca_id, categoria_id, preco,
  preco_promocional, estoque, peso_kg, imagens, complementares, ativo, destaque,
  produto_pai_id, variante_label,
  marca:marcas!produtos_marca_id_fkey(id, nome, slug),
  categoria:categorias!produtos_categoria_id_fkey(id, nome, slug)
`;

const PAGE_SIZE = 24;

/**
 * Cliente Supabase para uso EM SERVER COMPONENTS (anon key).
 * RLS garante que só lê o que é público.
 */
function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function listProdutos(params?: {
  marca?: string;
  categoria?: string;
  q?: string;
  page?: number;
  destaque?: boolean;
  promocao?: boolean;
  em_estoque?: boolean;
}): Promise<{ items: ProdutoComMarca[]; total: number }> {
  const sb = getServerSupabase();
  const page = params?.page ?? 1;
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  let query = sb
    .from("produtos")
    .select(PRODUTO_SELECT, { count: "exact" })
    .eq("ativo", true)
    // No catálogo público mostramos só os "pais" — variantes ficam visíveis
    // apenas dentro da página do produto pai.
    .is("produto_pai_id", null);

  if (params?.marca) {
    const marca = await sb
      .from("marcas")
      .select("id")
      .eq("slug", params.marca)
      .maybeSingle();
    if (!marca.data) return { items: [], total: 0 };
    query = query.eq("marca_id", marca.data.id);
  }

  if (params?.categoria) {
    const cat = await sb
      .from("categorias")
      .select("id")
      .eq("slug", params.categoria)
      .maybeSingle();
    if (!cat.data) return { items: [], total: 0 };
    query = query.eq("categoria_id", cat.data.id);
  }

  if (params?.destaque) query = query.eq("destaque", true);
  if (params?.promocao) query = query.not("preco_promocional", "is", null);
  if (params?.em_estoque) query = query.gt("estoque", 0);
  if (params?.q) query = query.ilike("nome", `%${params.q}%`);

  const { data, count } = await query
    .order("destaque", { ascending: false })
    .order("nome")
    .range(start, end);

  return {
    items: (data as unknown as ProdutoComMarca[]) ?? [],
    total: count ?? 0,
  };
}

export async function getProdutoBySlug(
  slug: string,
): Promise<
  | (ProdutoComMarca & {
      complementares_produtos: ProdutoComMarca[];
      variantes: ProdutoComMarca[];
    })
  | null
> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("produtos")
    .select(PRODUTO_SELECT)
    .eq("slug", slug)
    .eq("ativo", true)
    .maybeSingle();
  if (!data) return null;

  let produto = data as unknown as ProdutoComMarca;

  // Se o slug for de uma variante (filho), redireciona para o pai mas mantendo
  // a variante pré-selecionada — buscamos o pai e colocamos as variantes ao lado.
  if (produto.produto_pai_id) {
    const { data: paiData } = await sb
      .from("produtos")
      .select(PRODUTO_SELECT)
      .eq("id", produto.produto_pai_id)
      .eq("ativo", true)
      .maybeSingle();
    if (paiData) produto = paiData as unknown as ProdutoComMarca;
  }

  // Carrega todas as variantes (irmãs) — incluindo o próprio pai.
  const paiId = produto.id;
  const { data: vars } = await sb
    .from("produtos")
    .select(PRODUTO_SELECT)
    .or(`id.eq.${paiId},produto_pai_id.eq.${paiId}`)
    .eq("ativo", true)
    .order("variante_label", { nullsFirst: false });
  const variantes = (vars as unknown as ProdutoComMarca[]) ?? [];

  const ids = produto.complementares ?? [];
  let complementares_produtos: ProdutoComMarca[] = [];
  if (ids.length > 0) {
    const { data: comp } = await sb
      .from("produtos")
      .select(PRODUTO_SELECT)
      .in("id", ids)
      .eq("ativo", true);
    complementares_produtos = (comp as unknown as ProdutoComMarca[]) ?? [];
  }
  return { ...produto, complementares_produtos, variantes };
}

export async function listMarcas(): Promise<Marca[]> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("marcas")
    .select("id, nome, slug, logo_url")
    .eq("ativo", true)
    .order("ordem")
    .order("nome");
  const marcas = (data as Marca[]) ?? [];
  // Marcas com logo têm prioridade na seção "Marcas parceiras" da home.
  // O sort é estável: dentro de cada grupo, mantém a ordem (ordem, nome).
  return marcas.sort((a, b) => (a.logo_url ? 0 : 1) - (b.logo_url ? 0 : 1));
}

export async function listCategorias(): Promise<Categoria[]> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("categorias")
    .select("id, nome, slug, parent_id")
    .order("ordem")
    .order("nome");
  return (data as Categoria[]) ?? [];
}

export async function listBanners(): Promise<Banner[]> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("banners")
    .select("id, titulo, imagem_url, link, ordem")
    .eq("ativo", true)
    .order("ordem");
  return (data as Banner[]) ?? [];
}

export async function listCuponsHome(): Promise<CupomHome[]> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from("cupons")
    .select("id, codigo, descricao, tipo, valor")
    .eq("ativo", true)
    .eq("exibir_home", true)
    .or("validade.is.null,validade.gt." + new Date().toISOString());
  return (data as CupomHome[]) ?? [];
}
