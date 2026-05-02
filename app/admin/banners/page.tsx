import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BannersManager } from "./BannersManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banners" };

export default async function BannersPage() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("banners")
    .select("id, titulo, imagem_url, link, ordem, ativo, inicia_em, termina_em")
    .order("ordem")
    .order("criado_em", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Banners</h1>
      <p className="text-sm text-zinc-500">
        O carrossel da home rotaciona automaticamente entre os banners ativos.
      </p>
      <BannersManager banners={data ?? []} />
    </div>
  );
}
