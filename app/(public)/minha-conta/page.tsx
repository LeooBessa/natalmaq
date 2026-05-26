import { redirect } from "next/navigation";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBRL, formatPhone } from "@/lib/format";
import type { Endereco } from "@/types";
import { BotaoSair } from "./BotaoSair";
import { EditarPerfilForm } from "./EditarPerfilForm";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente:   { label: "Pendente",                cls: "bg-yellow-100 text-yellow-800" },
  aprovado:   { label: "Aprovado pelo vendedor",  cls: "bg-blue-100 text-blue-800" },
  confirmado: { label: "Confirmado pelo cliente", cls: "bg-purple-100 text-purple-800" },
  enviado:    { label: "Enviado",                 cls: "bg-ok/20 text-ok" },
  recusado:   { label: "Recusado",                cls: "bg-red-100 text-red-700" },
};

export default async function MinhaContaPage() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/auth?next=/minha-conta");

  const [{ data: cliente }, { data: pedidos }] = await Promise.all([
    sb
      .from("clientes")
      .select("nome, contato, email, endereco")
      .eq("id", user.id)
      .maybeSingle(),
    sb
      .from("pedidos")
      .select("id, numero, total, status, criado_em")
      .eq("cliente_id", user.id)
      .order("criado_em", { ascending: false })
      .limit(30),
  ]);

  const nome = (cliente?.nome as string) ?? user.email ?? "—";
  const primeiroNome = nome.split(" ")[0];
  const endereco = (cliente?.endereco as Endereco) ?? null;

  return (
    <div className="min-h-[80vh] bg-bone">
      {/* Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / MINHA CONTA
          </div>
          <div className="mt-2 flex items-center justify-between">
            <h1 className="font-display text-[28px] tracking-tight text-ink md:text-[36px]">
              Olá, {primeiroNome}
            </h1>
            <BotaoSair />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-6 px-6 py-8 lg:grid-cols-[320px_1fr]">
        {/* Perfil */}
        <section className="h-fit border border-line bg-white p-6">
          <div className="mb-4 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
            MEU PERFIL
          </div>

          <div className="space-y-3 text-sm">
            <InfoRow label="Nome" value={(cliente?.nome as string) ?? "—"} />
            <InfoRow
              label="E-mail"
              value={(cliente?.email as string) ?? user.email ?? "—"}
            />
            <InfoRow
              label="Telefone"
              value={
                cliente?.contato
                  ? formatPhone(cliente.contato as string)
                  : "—"
              }
            />
            {endereco && (
              <InfoRow
                label="Endereço"
                value={`${endereco.rua}, ${endereco.numero}${endereco.complemento ? ` — ${endereco.complemento}` : ""} · ${endereco.bairro} · ${endereco.cidade}/${endereco.uf}`}
              />
            )}
          </div>

          <EditarPerfilForm
            nome={(cliente?.nome as string) ?? ""}
            contato={(cliente?.contato as string) ?? ""}
            endereco={endereco}
          />
        </section>

        {/* Pedidos */}
        <div>
          <div className="mb-3 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
            MEUS PEDIDOS
          </div>

          {!pedidos || pedidos.length === 0 ? (
            <div className="border border-dashed border-line bg-white p-14 text-center">
              <div className="font-mono text-[12px] uppercase tracking-mono text-ink-2">
                NENHUM PEDIDO AINDA
              </div>
              <p className="mt-2 text-sm text-ink-2">
                Seus orçamentos confirmados aparecerão aqui.
              </p>
              <Link
                href="/catalogo"
                className="mt-5 inline-block bg-navy px-5 py-2.5 font-mono text-[11px] font-bold uppercase tracking-mono text-white hover:bg-navy-800"
              >
                Explorar catálogo →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.map((p) => {
                const s =
                  p.status
                    ? (STATUS[p.status] ?? { label: p.status, cls: "bg-bone text-ink-2" })
                    : { label: "Aguardando", cls: "bg-bone text-ink-2" };
                return (
                  <Link
                    key={p.id}
                    href={`/minha-conta/pedido/${p.id}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 border border-line bg-white p-4 transition hover:border-navy"
                  >
                    <div>
                      <div className="font-mono text-[12px] font-bold text-ink">
                        PEDIDO #{String(p.numero).padStart(5, "0")}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-2">
                        {new Date(p.criado_em).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                      <span
                        className={`mt-1.5 inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-mono ${s.cls}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[20px] tracking-tight text-ink">
                        {formatBRL(Number(p.total))}
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
                        Ver detalhes →
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-ink-2">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
