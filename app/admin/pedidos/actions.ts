"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Status = "pendente" | "aprovado" | "enviado" | "recusado";

export async function updateStatusAction(
  pedidoId: string,
  novoStatus: Status,
  observacoes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb
    .from("pedidos")
    .update({
      status: novoStatus,
      ...(observacoes !== undefined ? { observacoes } : {}),
    })
    .eq("id", pedidoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${pedidoId}`);
  revalidatePath("/admin/dashboard");
  return { ok: true };
}
