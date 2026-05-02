import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KanbanBoard } from "./KanbanBoard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kanban de pedidos" };

export type KanbanPedido = {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_telefone: string;
  total: number;
  status: "pendente" | "aprovado" | "enviado" | "recusado";
  criado_em: string;
};

export default async function KanbanPage() {
  const sb = await createSupabaseServerClient();
  const { data } = await sb
    .from("pedidos")
    .select("id, numero, cliente_nome, cliente_telefone, total, status, criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);

  const pedidos = (data ?? []) as KanbanPedido[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kanban de pedidos</h1>
          <p className="text-sm text-zinc-500">
            Arraste cartões entre colunas para mudar status. Limite: 200 pedidos mais recentes.
          </p>
        </div>
        <Link
          href="/admin/pedidos"
          className="text-sm font-semibold text-brand-600 hover:underline"
        >
          Ver lista →
        </Link>
      </div>

      <KanbanBoard pedidos={pedidos} />
    </div>
  );
}
