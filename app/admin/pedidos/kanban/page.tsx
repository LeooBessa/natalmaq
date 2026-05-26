import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KanbanBoard } from "./KanbanBoard";
import type { PedidoStatus } from "../_lib/status";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kanban de pedidos" };

export type KanbanPedido = {
  id: string;
  numero: number;
  cliente_nome: string;
  cliente_telefone: string;
  total: number;
  status: PedidoStatus;
  criado_em: string;
  enviado_em: string | null;
  recusado_em: string | null;
};

export default async function KanbanPage() {
  const sb = await createSupabaseServerClient();

  // 7 dias atras em ISO.
  const seteDiasAtras = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Regra de arquivamento:
  // - Pedidos pendentes/aprovados/confirmados aparecem SEMPRE.
  // - Pedidos enviados ficam visiveis ate 7 dias apos enviado_em.
  // - Pedidos recusados ficam visiveis ate 7 dias apos recusado_em.
  // (pedidos antigos sem timestamp recebem atualizado_em no backfill da 0015,
  //  entao a logica funciona pra dados pre-existentes tambem.)
  const { data } = await sb
    .from("pedidos")
    .select(
      "id, numero, cliente_nome, cliente_telefone, total, status, criado_em, enviado_em, recusado_em",
    )
    .or(
      `status.in.(pendente,aprovado,confirmado),and(status.eq.enviado,enviado_em.gte.${seteDiasAtras}),and(status.eq.recusado,recusado_em.gte.${seteDiasAtras})`,
    )
    .order("criado_em", { ascending: true }) // FIFO: mais antigo primeiro
    .limit(400);

  const pedidos = (data ?? []) as KanbanPedido[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kanban de pedidos</h1>
          <p className="text-sm text-zinc-500">
            Arraste cartões entre colunas para mudar status. Enviado/Recusado &gt; 7 dias vão pro{" "}
            <Link href="/admin/pedidos/historico" className="text-brand-600 hover:underline">
              histórico
            </Link>
            .
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
