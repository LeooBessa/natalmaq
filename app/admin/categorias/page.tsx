import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CategoriasManager } from "./CategoriasManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorias" };

export default async function CategoriasPage() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("categorias")
    .select("id, nome, slug, parent_id, ordem")
    .order("ordem")
    .order("nome");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categorias</h1>
      <CategoriasManager categorias={data ?? []} />
    </div>
  );
}
