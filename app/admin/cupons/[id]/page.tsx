import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Cupom } from "@/types";
import { CupomForm } from "../CupomForm";
import { atualizarCupomAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditarCupomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();
  const { data } = await sb.from("cupons").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  const cupom = data as Cupom;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/cupons" className="text-sm text-zinc-500 hover:text-brand-600">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">
          Editar cupom — <span className="font-mono">{cupom.codigo}</span>
        </h1>
        <p className="text-sm text-zinc-500">
          {cupom.usos_atual} uso{cupom.usos_atual !== 1 ? "s" : ""} registrado{cupom.usos_atual !== 1 ? "s" : ""}
        </p>
      </div>
      <CupomForm
        cupom={cupom}
        onSave={(data) => atualizarCupomAction(id, data)}
      />
    </div>
  );
}
