"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatPhone, formatCEP } from "@/lib/format";
import type { Endereco } from "@/types";
import { atualizarPerfilAction } from "./actions";

type Props = {
  nome: string;
  contato: string;
  endereco: Endereco | null;
};

export function EditarPerfilForm({ nome, contato, endereco }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-4 font-mono text-[11px] uppercase tracking-mono text-brand-500 hover:text-brand-400"
      >
        Editar perfil →
      </button>
    );
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await atualizarPerfilAction(fd);
      if (r.ok) {
        setSucesso(true);
        router.refresh();
        setTimeout(() => setAberto(false), 1500);
      } else {
        setErro(r.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 border-t border-line pt-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nome completo *">
          <input
            name="nome"
            defaultValue={nome}
            required
            minLength={2}
            className={inputCls}
          />
        </Field>
        <Field label="WhatsApp / Telefone *">
          <input
            name="contato"
            defaultValue={formatPhone(contato)}
            required
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="CEP">
          <input
            name="cep"
            defaultValue={endereco?.cep ? formatCEP(endereco.cep) : ""}
            placeholder="59000-000"
            className={inputCls}
          />
        </Field>
        <Field label="Rua" className="md:col-span-2">
          <input
            name="rua"
            defaultValue={endereco?.rua ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Número">
          <input
            name="numero"
            defaultValue={endereco?.numero ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Bairro">
          <input
            name="bairro"
            defaultValue={endereco?.bairro ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="Complemento">
          <input
            name="complemento"
            defaultValue={endereco?.complemento ?? ""}
            placeholder="Apto, bloco..."
            className={inputCls}
          />
        </Field>
        <Field label="Cidade" className="md:col-span-2">
          <input
            name="cidade"
            defaultValue={endereco?.cidade ?? ""}
            className={inputCls}
          />
        </Field>
        <Field label="UF">
          <input
            name="uf"
            defaultValue={endereco?.uf ?? ""}
            maxLength={2}
            placeholder="RN"
            className={inputCls}
          />
        </Field>
      </div>

      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
      {sucesso && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Perfil atualizado!
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-navy px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-mono text-white hover:bg-navy-800 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="px-5 py-2 font-mono text-[11px] uppercase tracking-mono text-ink-2 hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
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
