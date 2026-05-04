"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { api } from "@/lib/api-client";
import { useCart } from "@/lib/cart-store";
import { formatBRL, formatCEP, formatPhone, onlyDigits } from "@/lib/format";
import type { FreteCalculado } from "@/types";
import { validarCupomAction } from "./actions";

export default function CheckoutPage() {
  const { itens, subtotal, pesoTotal, clear, cupom, aplicarCupom, removerCupom } = useCart();

  const [form, setForm] = useState({
    cliente_nome: "",
    cliente_telefone: "",
    cliente_email: "",
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
    complemento: "",
    observacoes: "",
  });
  const [frete, setFrete] = useState<FreteCalculado | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [submit, setSubmit] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [cupomInput, setCupomInput] = useState("");
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [cupomPending, startCupomTransition] = useTransition();

  if (itens.length === 0) {
    return (
      <div className="bg-bone py-20 text-center">
        <div className="mx-auto max-w-md">
          <div className="font-mono text-[12px] uppercase tracking-mono text-ink-2">
            CESTA VAZIA
          </div>
          <h1 className="mt-2 font-display text-[28px] tracking-tight text-ink">
            Adicione produtos antes do checkout
          </h1>
          <Link
            href="/catalogo"
            className="mt-6 inline-block bg-navy px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-mono text-white hover:bg-navy-800"
          >
            Ver catálogo →
          </Link>
        </div>
      </div>
    );
  }

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function calcularFrete() {
    setErro(null);
    const cepDigits = onlyDigits(form.cep);
    if (cepDigits.length !== 8) {
      setErro("CEP inválido");
      return;
    }
    setCalcLoading(true);
    try {
      const r = await api.frete.calcular(cepDigits, pesoTotal());
      setFrete(r);
    } catch (e) {
      setErro((e as Error).message);
      setFrete(null);
    } finally {
      setCalcLoading(false);
    }
  }

  function aplicarCupomHandler() {
    setCupomErro(null);
    const codigo = cupomInput.trim().toUpperCase();
    if (!codigo) return;
    startCupomTransition(async () => {
      const res = await validarCupomAction(codigo, subtotal());
      if (res.ok) {
        aplicarCupom({ codigo: res.codigo, descricao: res.descricao, desconto: res.desconto });
        setCupomInput("");
      } else {
        setCupomErro(res.erro);
      }
    });
  }

  async function finalizar() {
    setErro(null);
    if (!form.cliente_nome || !form.cliente_telefone) {
      setErro("Preencha nome e telefone.");
      return;
    }
    if (!frete) {
      setErro("Calcule o frete antes de finalizar.");
      return;
    }
    if (!form.cep || !form.rua || !form.numero || !form.bairro || !form.cidade || !form.uf) {
      setErro("Preencha o endereço completo.");
      return;
    }

    setSubmit(true);
    try {
      const pedido = await api.pedidos.criar({
        cliente_nome: form.cliente_nome,
        cliente_telefone: onlyDigits(form.cliente_telefone),
        cliente_email: form.cliente_email || undefined,
        endereco: {
          cep: onlyDigits(form.cep),
          rua: form.rua,
          numero: form.numero,
          bairro: form.bairro,
          cidade: form.cidade,
          uf: form.uf.toUpperCase(),
          complemento: form.complemento || undefined,
        },
        observacoes: form.observacoes || undefined,
        itens: itens.map((i) => ({
          produto_id: i.produto_id,
          quantidade: i.quantidade,
        })),
        frete_valor: frete.valor,
        cupom_codigo: cupom?.codigo,
        desconto_valor: cupom?.desconto,
      });

      clear();
      window.location.href = pedido.whatsapp_url;
    } catch (e) {
      setErro((e as Error).message);
      setSubmit(false);
    }
  }

  const desconto = cupom?.desconto ?? 0;
  const total = subtotal() - desconto + (frete?.valor ?? 0);

  return (
    <div className="bg-bone">
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / FINALIZAR ORÇAMENTO
          </div>
          <h1 className="mt-2 font-display text-[28px] tracking-tight text-ink md:text-[36px]">
            Finalizar orçamento
          </h1>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-6 px-6 py-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="border border-line bg-white p-6">
            <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
              SEUS DADOS
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome completo *">
                <input
                  value={form.cliente_nome}
                  onChange={(e) => update("cliente_nome", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="WhatsApp / Telefone *">
                <input
                  value={form.cliente_telefone}
                  onChange={(e) =>
                    update("cliente_telefone", formatPhone(e.target.value))
                  }
                  placeholder="(84) 9 0000-0000"
                  className={inputCls}
                />
              </Field>
              <Field label="E-mail (opcional)" className="md:col-span-2">
                <input
                  type="email"
                  value={form.cliente_email}
                  onChange={(e) => update("cliente_email", e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          <section className="border border-line bg-white p-6">
            <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
              ENDEREÇO DE ENTREGA
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="CEP *">
                <div className="flex gap-2">
                  <input
                    value={form.cep}
                    onChange={(e) => update("cep", formatCEP(e.target.value))}
                    placeholder="59000-000"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={calcularFrete}
                    disabled={calcLoading}
                    className="bg-navy px-4 font-mono text-[11px] font-bold uppercase tracking-mono text-white hover:bg-navy-800 disabled:opacity-50"
                  >
                    {calcLoading ? "..." : "Calcular"}
                  </button>
                </div>
              </Field>
              <Field label="Rua *" className="md:col-span-2">
                <input value={form.rua} onChange={(e) => update("rua", e.target.value)} placeholder="Nome da rua" className={inputCls} />
              </Field>
              <Field label="Número *">
                <input value={form.numero} onChange={(e) => update("numero", e.target.value)} placeholder="Nº" className={inputCls} />
              </Field>
              <Field label="Bairro *">
                <input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} placeholder="Bairro" className={inputCls} />
              </Field>
              <Field label="Complemento">
                <input value={form.complemento} onChange={(e) => update("complemento", e.target.value)} placeholder="Apto, bloco..." className={inputCls} />
              </Field>
              <Field label="Cidade *" className="md:col-span-2">
                <input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} placeholder="Cidade" className={inputCls} />
              </Field>
              <Field label="UF *">
                <input
                  value={form.uf}
                  maxLength={2}
                  onChange={(e) => update("uf", e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="RN"
                  className={inputCls}
                />
              </Field>
            </div>
          </section>

          <section className="border border-line bg-white p-6">
            <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
              OBSERVAÇÕES
            </h2>
            <textarea
              value={form.observacoes}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={3}
              placeholder="Algum detalhe sobre o pedido?"
              className={inputCls}
            />
          </section>
        </div>

        <aside className="h-fit space-y-3 bg-navy p-6 text-white">
          <div className="font-mono text-[11px] uppercase tracking-mono text-brand-400">
            RESUMO DA PROPOSTA
          </div>
          <ul className="space-y-2 border-b border-white/15 pb-3 text-sm">
            {itens.map((it) => (
              <li key={it.produto_id} className="flex justify-between gap-2">
                <span className="line-clamp-1 text-white/80">
                  {it.quantidade}× {it.nome}
                </span>
                <span className="whitespace-nowrap font-semibold">
                  {formatBRL(it.preco_unit * it.quantidade)}
                </span>
              </li>
            ))}
          </ul>

          <Row label="Subtotal" value={formatBRL(subtotal())} />

          {/* Cupom aplicado */}
          {cupom ? (
            <div className="flex items-center justify-between rounded border border-ok/40 bg-ok/10 px-3 py-2 text-sm">
              <div>
                <span className="font-mono font-bold text-ok">{cupom.codigo}</span>
                {cupom.descricao && (
                  <span className="ml-2 text-white/60 text-xs">{cupom.descricao}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ok">−{formatBRL(cupom.desconto)}</span>
                <button
                  type="button"
                  onClick={removerCupom}
                  className="text-white/40 hover:text-white text-xs"
                  title="Remover cupom"
                >
                  ×
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="font-mono text-[10px] uppercase tracking-mono text-white/50 mb-1">
                CUPOM DE DESCONTO
              </div>
              <div className="flex gap-2">
                <input
                  value={cupomInput}
                  onChange={(e) => { setCupomInput(e.target.value.toUpperCase()); setCupomErro(null); }}
                  onKeyDown={(e) => e.key === "Enter" && aplicarCupomHandler()}
                  placeholder="CÓDIGO"
                  className="flex-1 border border-white/20 bg-white/10 px-3 py-2 font-mono text-[12px] uppercase text-white placeholder:text-white/30 outline-none focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={aplicarCupomHandler}
                  disabled={cupomPending || !cupomInput.trim()}
                  className="bg-brand-500 px-4 font-mono text-[11px] font-bold uppercase tracking-mono text-white hover:bg-brand-400 disabled:opacity-40"
                >
                  {cupomPending ? "..." : "Aplicar"}
                </button>
              </div>
              {cupomErro && (
                <p className="mt-1 text-[11px] text-brand-400">{cupomErro}</p>
              )}
            </div>
          )}

          <Row
            label="Frete"
            value={frete ? `${formatBRL(frete.valor)} · ${frete.prazo_dias} dia(s)` : "—"}
          />

          <div className="mt-2 flex items-end justify-between border-t border-white/15 pt-3">
            <div className="font-mono text-[11px] uppercase tracking-mono text-white/70">TOTAL</div>
            <div className="font-display text-[26px] tracking-tight">{formatBRL(total)}</div>
          </div>

          {erro && (
            <div className="border border-brand-500 bg-brand-500/10 p-3 text-sm text-brand-100">
              {erro}
            </div>
          )}

          <button
            type="button"
            onClick={finalizar}
            disabled={submit || !frete}
            className="block w-full bg-brand-500 py-4 font-mono text-[12px] font-bold uppercase tracking-mono text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submit ? "Enviando..." : "Finalizar via WhatsApp →"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-white/60">
            Criamos seu orçamento e abrimos o WhatsApp para confirmar com a equipe.
          </p>
        </aside>
      </div>
    </div>
  );
}

const inputCls =
  "w-full border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-navy";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-mono text-ink-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-white/75">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
