import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FreteManager, type Regra } from "./FreteManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Frete" };

const CATCHALL_INI = "00000000";
const CATCHALL_FIM = "99999999";

export default async function FretePage() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("fretes_regra")
    .select("id, nome, uf, faixa_cep_inicio, faixa_cep_fim, valor, prazo_dias, por_kg, ordem")
    .order("ordem");

  const regras = (data ?? []) as Regra[];
  const padrao =
    regras.find(
      (r) => r.faixa_cep_inicio === CATCHALL_INI && r.faixa_cep_fim === CATCHALL_FIM,
    ) ?? null;
  const excecoes = regras.filter((r) => r.id !== padrao?.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Frete</h1>
        <p className="text-sm text-zinc-500">
          Defina o frete padrão e, se quiser, preços diferentes por região (faixa
          de CEP). O valor aparece no checkout quando o cliente calcula pelo CEP.
        </p>
      </div>
      <FreteManager padrao={padrao} excecoes={excecoes} />
    </div>
  );
}
