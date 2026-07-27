"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, MapPin } from "lucide-react";

import { formatBRL, formatCEP } from "@/lib/format";
import {
  deleteExcecaoFreteAction,
  saveDefaultFreteAction,
  saveExcecaoFreteAction,
} from "./actions";

export type Regra = {
  id: string;
  nome: string | null;
  uf: string | null;
  faixa_cep_inicio: string;
  faixa_cep_fim: string;
  valor: number;
  prazo_dias: number;
  por_kg: number;
  ordem: number;
};

const vazia = {
  id: "",
  nome: "",
  faixa_cep_inicio: "",
  faixa_cep_fim: "",
  valor: "",
  prazo_dias: "3",
};

export function FreteManager({
  padrao,
  excecoes,
}: {
  padrao: Regra | null;
  excecoes: Regra[];
}) {
  return (
    <div className="space-y-8">
      <DefaultCard padrao={padrao} />
      <ExcecoesSection excecoes={excecoes} />
    </div>
  );
}

function DefaultCard({ padrao }: { padrao: Regra | null }) {
  const [valor, setValor] = useState(padrao ? String(padrao.valor) : "6.99");
  const [prazo, setPrazo] = useState(padrao ? String(padrao.prazo_dias) : "3");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  function salvar() {
    if (!padrao) return;
    setMsg(null);
    start(async () => {
      const r = await saveDefaultFreteAction(
        padrao.id,
        Number(valor.replace(",", ".")),
        Number(prazo),
      );
      setMsg(r.error ? { ok: false, t: r.error } : { ok: true, t: "Frete padrão salvo ✓" });
    });
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-semibold">Frete padrão</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Valor cobrado onde <b>nenhuma região abaixo</b> se aplica. É o seu frete
        base para todo o resto do país.
      </p>
      {!padrao ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Regra padrão não encontrada — rode a migration 0032 no Supabase.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-700">Valor (R$)</span>
            <input
              type="number" step="0.01" min="0" value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-32 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-700">Prazo (dias)</span>
            <input
              type="number" step="1" min="0" value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-28 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </label>
          <button
            onClick={salvar} disabled={pending}
            className="rounded-md bg-brand-600 px-5 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Salvando..." : "Salvar padrão"}
          </button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.t}</span>
          )}
        </div>
      )}
    </section>
  );
}

function ExcecoesSection({ excecoes }: { excecoes: Regra[] }) {
  const [editando, setEditando] = useState<typeof vazia>(vazia);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function editar(r: Regra) {
    setErro(null);
    setEditando({
      id: r.id,
      nome: r.nome ?? "",
      faixa_cep_inicio: r.faixa_cep_inicio,
      faixa_cep_fim: r.faixa_cep_fim,
      valor: String(r.valor),
      prazo_dias: String(r.prazo_dias),
    });
  }
  function reset() {
    setEditando(vazia);
    setErro(null);
  }

  function onSubmit(formData: FormData) {
    setErro(null);
    if (editando.id) formData.set("id", editando.id);
    start(async () => {
      const r = await saveExcecaoFreteAction(formData);
      if (r.error) setErro(r.error);
      else reset();
    });
  }

  function excluir(id: string) {
    if (!confirm("Excluir esta região?")) return;
    start(async () => {
      const r = await deleteExcecaoFreteAction(id);
      if (r.error) setErro(r.error);
    });
  }

  return (
    <section>
      <h2 className="font-semibold">Preços por região</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        Cobre uma faixa de CEP com um preço diferente do padrão. O frete usa a
        região que casar com o CEP do cliente; se nenhuma casar, usa o padrão.
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          {excecoes.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-medium text-zinc-900">
                  <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />
                  {r.nome || "Região"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  CEP {formatCEP(r.faixa_cep_inicio)} → {formatCEP(r.faixa_cep_fim)}
                </p>
                <p className="mt-1 text-sm">
                  <b>{formatBRL(r.valor)}</b>
                  <span className="text-zinc-500"> · {r.prazo_dias} dia(s)</span>
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => editar(r)} title="Editar" className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-brand-600">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => excluir(r.id)} title="Excluir" className="rounded p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {excecoes.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Nenhuma região cadastrada. Todo mundo paga o frete padrão. Crie uma
              região no formulário ao lado para cobrar diferente por CEP.
            </div>
          )}
        </div>

        <form action={onSubmit} className="h-fit space-y-3 rounded-lg border border-zinc-200 bg-white p-5">
          <h3 className="font-semibold">{editando.id ? "Editar região" : "Nova região"}</h3>

          <Campo label="Nome da região *">
            <input name="nome" defaultValue={editando.nome} key={editando.id + "n"} placeholder="Natal e região" className={input} required />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CEP inicial *">
              <input name="faixa_cep_inicio" defaultValue={editando.faixa_cep_inicio ? formatCEP(editando.faixa_cep_inicio) : ""} key={editando.id + "ci"} placeholder="59000-000" className={input} required />
            </Campo>
            <Campo label="CEP final *">
              <input name="faixa_cep_fim" defaultValue={editando.faixa_cep_fim ? formatCEP(editando.faixa_cep_fim) : ""} key={editando.id + "cf"} placeholder="59299-999" className={input} required />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor (R$) *">
              <input type="number" step="0.01" min="0" name="valor" defaultValue={editando.valor} key={editando.id + "v"} placeholder="6.99" className={input} required />
            </Campo>
            <Campo label="Prazo (dias)">
              <input type="number" step="1" min="0" name="prazo_dias" defaultValue={editando.prazo_dias} key={editando.id + "p"} className={input} />
            </Campo>
          </div>

          {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={pending} className="flex-1 rounded-md bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {pending ? "Salvando..." : editando.id ? "Salvar" : "Criar região"}
            </button>
            {editando.id && (
              <button type="button" onClick={reset} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold hover:bg-zinc-50">
                Cancelar
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Dica: Natal e região = 59000-000 a 59299-999. Interior do RN =
            59300-000 a 59999-999.
          </p>
        </form>
      </div>
    </section>
  );
}

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-zinc-700">{label}</span>
      {children}
    </label>
  );
}
