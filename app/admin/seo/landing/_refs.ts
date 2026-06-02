// Carregadores de referências do editor de landing (produtos p/ a vitrine +
// categorias/marcas/clusters p/ os selects de vínculo). Tudo em try/catch:
// se clusters/landing_pages ainda não existirem (migration 0019 não aplicada),
// devolvemos listas vazias para o editor não quebrar.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PickerProduto } from "../_components/ProdutoPicker";
import type { Option, ClusterOption } from "./[id]/LandingEditor";

export type LandingRefs = {
  produtos: PickerProduto[];
  categorias: Option[];
  marcas: Option[];
  clusters: ClusterOption[];
};

async function safe<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function loadLandingRefs(): Promise<LandingRefs> {
  const sb = await createSupabaseServerClient();

  const [produtos, categorias, marcas, clusters] = await Promise.all([
    safe<PickerProduto>(async () => {
      const { data, error } = await sb
        .from("produtos")
        .select("id, nome, codigo, imagens")
        .eq("ativo", true)
        .order("nome")
        .limit(2000);
      if (error) return [];
      return ((data ?? []) as unknown as Array<{
        id: string;
        nome: string;
        codigo: string | null;
        imagens: string[] | null;
      }>).map((p) => ({
        id: p.id,
        nome: p.nome,
        codigo: p.codigo,
        imagem: Array.isArray(p.imagens) && p.imagens.length > 0 ? p.imagens[0] : null,
      }));
    }),
    safe<Option>(async () => {
      const { data, error } = await sb
        .from("categorias")
        .select("id, nome")
        .order("nome");
      if (error) return [];
      return (data ?? []) as unknown as Option[];
    }),
    safe<Option>(async () => {
      const { data, error } = await sb
        .from("marcas")
        .select("id, nome")
        .order("nome");
      if (error) return [];
      return (data ?? []) as unknown as Option[];
    }),
    safe<ClusterOption>(async () => {
      const { data, error } = await sb
        .from("clusters")
        .select("id, titulo")
        .order("ordem")
        .order("titulo");
      if (error) return [];
      return (data ?? []) as unknown as ClusterOption[];
    }),
  ]);

  return { produtos, categorias, marcas, clusters };
}
