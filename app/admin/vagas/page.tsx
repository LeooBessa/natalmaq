import { createSupabaseServerClient } from "@/lib/supabase/server";
import { VagasManager } from "./VagasManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vagas" };

export default async function VagasPage() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("vagas")
    .select("id, titulo, descricao, tipo, local, ativo, ordem, criado_em")
    .order("ordem")
    .order("criado_em", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Vagas de emprego</h1>
      <p className="text-sm text-zinc-500">
        Anuncie vagas. As <b>ativas</b> aparecem na seção “Trabalhe conosco” do
        institucional (candidatura por e-mail). Cada vaga pode virar um banner do
        carrossel da home pelo botão “Criar banner desta vaga”.
      </p>
      <VagasManager vagas={data ?? []} />
    </div>
  );
}
