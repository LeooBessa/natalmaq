import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import type { Endereco } from "@/types";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente",  cls: "bg-yellow-100 text-yellow-800" },
  aprovado: { label: "Aprovado",  cls: "bg-blue-100 text-blue-800" },
  enviado:  { label: "Enviado",   cls: "bg-ok/20 text-ok" },
  recusado: { label: "Recusado",  cls: "bg-red-100 text-red-700" },
};

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/auth?next=/minha-conta");

  const { data: pedido } = await sb
    .from("pedidos")
    .select(
      `id, numero, criado_em, status, total, subtotal, frete_valor,
       desconto_valor, cupom_codigo, observacoes, whatsapp_url, endereco,
       forma_pagamento,
       pedido_itens(id, nome_snapshot, codigo, quantidade, preco_unit, preco_total, disponivel)`,
    )
    .eq("id", id)
    .eq("cliente_id", user.id)
    .maybeSingle();

  if (!pedido) notFound();

  const endereco = pedido.endereco as Endereco | null;
  const itens = (pedido.pedido_itens ?? []) as {
    id: string;
    nome_snapshot: string;
    codigo: string;
    quantidade: number;
    preco_unit: number;
    preco_total: number;
    disponivel: boolean;
  }[];

  const s =
    pedido.status
      ? (STATUS[pedido.status] ?? { label: pedido.status, cls: "bg-bone text-ink-2" })
      : { label: "Aguardando", cls: "bg-bone text-ink-2" };

  return (
    <div className="min-h-[80vh] bg-bone">
      {/* Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            <Link href="/minha-conta" className="hover:text-ink">
              MINHA CONTA
            </Link>{" "}
            / PEDIDO
          </div>
          <div className="mt-2 flex items-end gap-4">
            <h1 className="font-display text-[28px] tracking-tight text-ink md:text-[36px]">
              Pedido #{String(pedido.numero).padStart(5, "0")}
            </h1>
            <span
              className={`mb-1 inline-block rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-mono ${s.cls}`}
            >
              {s.label}
            </span>
          </div>
          <div className="mt-1 text-sm text-ink-2">
            {new Date(pedido.criado_em).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-6 px-6 py-8 lg:grid-cols-[1fr_300px]">
        {/* Itens */}
        <div>
          <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
            ITENS DO PEDIDO
          </div>
          <div className="space-y-2">
            {itens.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-4 border border-line bg-white p-4 ${!item.disponivel ? "opacity-50" : ""}`}
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
                    {item.codigo}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-ink">
                    {item.nome_snapshot}
                  </div>
                  {!item.disponivel && (
                    <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-mono text-red-700">
                      Sem estoque
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
                    {item.quantidade} × {formatBRL(Number(item.preco_unit))}
                  </div>
                  <div className="font-display text-[18px] tracking-tight text-ink">
                    {formatBRL(Number(item.preco_total))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pedido.observacoes && (
            <div className="mt-4 border border-line bg-white p-4">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-mono text-ink-2">
                OBSERVAÇÕES
              </div>
              <p className="text-sm text-ink">{pedido.observacoes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <aside className="bg-navy p-6 text-white">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-mono text-brand-400">
              RESUMO
            </div>
            <SideRow k="Subtotal" v={formatBRL(Number(pedido.subtotal))} />
            {Number(pedido.desconto_valor) > 0 && (
              <SideRow
                k={pedido.cupom_codigo ? `Cupom (${pedido.cupom_codigo})` : "Desconto"}
                v={`−${formatBRL(Number(pedido.desconto_valor))}`}
              />
            )}
            <SideRow k="Frete" v={formatBRL(Number(pedido.frete_valor))} />
            {pedido.forma_pagamento && (
              <SideRow k="Pagamento" v={pedido.forma_pagamento} />
            )}
            <div className="mt-3 flex items-end justify-between border-t border-white/15 pt-3">
              <div className="font-mono text-[11px] uppercase tracking-mono text-white/70">
                TOTAL
              </div>
              <div className="font-display text-[24px] tracking-tight">
                {formatBRL(Number(pedido.total))}
              </div>
            </div>
          </aside>

          {endereco && (
            <section className="border border-line bg-white p-4">
              <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-mono text-ink-2">
                ENDEREÇO DE ENTREGA
              </div>
              <p className="text-sm text-ink">
                {endereco.rua}, {endereco.numero}
                {endereco.complemento && ` — ${endereco.complemento}`}
              </p>
              <p className="text-sm text-ink-2">
                {endereco.bairro} · {endereco.cidade}/{endereco.uf} ·{" "}
                {endereco.cep}
              </p>
            </section>
          )}

          {pedido.whatsapp_url && (
            <a
              href={pedido.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-ok py-3 text-center font-mono text-[11px] font-bold uppercase tracking-mono text-white hover:opacity-90"
            >
              Abrir no WhatsApp →
            </a>
          )}

          <Link
            href="/minha-conta"
            className="block text-center font-mono text-[11px] uppercase tracking-mono text-ink-2 hover:text-ink"
          >
            ← Voltar à minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}

function SideRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-white/70">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
