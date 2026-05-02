import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MarcasManager } from "./MarcasManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marcas" };

export default async function MarcasPage() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("marcas")
    .select("id, nome, slug, logo_url, ordem, ativo")
    .order("ordem")
    .order("nome");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Marcas</h1>
      <MarcasManager marcas={data ?? []} />
    </div>
  );
}
