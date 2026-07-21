"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Endereco } from "@/types";
import { SITE_URL } from "@/lib/site-url";

type Tab = "entrar" | "cadastro";

type Props = {
  defaultTab: Tab;
  next: string;
};

const inputCls =
  "w-full rounded border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500";

async function buscarCep(cep: string) {
  const limpo = cep.replace(/\D/g, "");
  if (limpo.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    const d = await r.json();
    if (d.erro) return null;
    return {
      rua: d.logradouro ?? "",
      bairro: d.bairro ?? "",
      cidade: d.localidade ?? "",
      uf: d.uf ?? "",
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const senha = String(fd.get("senha") ?? "");
    startTransition(async () => {
      // signIn no cliente: seta cookie via @supabase/ssr E dispara
      // onAuthStateChange(SIGNED_IN) → UserNavBar atualiza nome sem F5.
      const sb = createSupabaseBrowserClient();
      const { error } = await sb.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        setErro("E-mail ou senha inválidos.");
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className={labelCls}>E-mail</label>
        <input name="email" type="email" required autoComplete="email" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Senha</label>
        <input name="senha" type="password" required autoComplete="current-password" className={inputCls} />
      </div>

      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-brand-500 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-400 disabled:opacity-50"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>

      <div className="text-center">
        <Link href="/auth/recuperar" className="text-sm text-brand-600 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------
function CadastroForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  async function onCepChange(cep: string) {
    const dados = await buscarCep(cep);
    if (dados) {
      setRua(dados.rua);
      setBairro(dados.bairro);
      setCidade(dados.cidade);
      setUf(dados.uf);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);

    const email = String(fd.get("email") ?? "").trim();
    const senha = String(fd.get("senha") ?? "");
    const confirmarSenha = String(fd.get("confirmar_senha") ?? "");
    const nome = String(fd.get("nome") ?? "").trim();
    const contato = String(fd.get("contato") ?? "").trim();

    if (!email || !senha || !nome || !contato) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    const endereco: Endereco = {
      cep: String(fd.get("cep") ?? "").replace(/\D/g, ""),
      rua: String(fd.get("rua") ?? "").trim(),
      numero: String(fd.get("numero") ?? "").trim(),
      bairro: String(fd.get("bairro") ?? "").trim(),
      cidade: String(fd.get("cidade") ?? "").trim(),
      uf: String(fd.get("uf") ?? "").trim().toUpperCase(),
      complemento: String(fd.get("complemento") ?? "").trim() || undefined,
    };

    startTransition(async () => {
      // signUp no cliente: dispara onAuthStateChange(SIGNED_IN) automaticamente
      // quando ja vem com sessao imediata (sem email confirmation).
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          setErro("Este e-mail já está cadastrado. Faça login.");
        } else {
          setErro(error.message);
        }
        return;
      }

      if (!data.user) {
        setErro("Erro ao criar conta. Tente novamente.");
        return;
      }

      // Cria perfil em clientes (RLS permite self-insert via auth.uid() = id).
      const { error: clienteError } = await sb.from("clientes").insert({
        id: data.user.id,
        nome,
        contato,
        email,
        endereco,
      });
      if (clienteError) {
        setErro("Erro ao salvar perfil: " + clienteError.message);
        return;
      }

      // Sessao imediata → loga direto e atualiza header sem F5.
      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }

      // Sem sessao → email confirmation pendente.
      setConfirmar(true);
    });
  }

  if (confirmar) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
          ✉️
        </div>
        <h3 className="font-semibold text-zinc-900">Confirme seu e-mail</h3>
        <p className="text-sm text-zinc-500">
          Enviamos um link de confirmação para o seu e-mail. Clique no link para
          ativar sua conta e continuar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Nome completo *</label>
          <input name="nome" type="text" required autoComplete="name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>E-mail *</label>
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Telefone / WhatsApp *</label>
          <input
            name="contato"
            type="tel"
            required
            placeholder="(84) 99999-9999"
            autoComplete="tel"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Senha *</label>
          <input
            name="senha"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Mín. 6 caracteres"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Confirmar senha *</label>
          <input
            name="confirmar_senha"
            type="password"
            required
            autoComplete="new-password"
            className={inputCls}
          />
        </div>
      </div>

      {/* Endereço */}
      <div className="border-t border-zinc-100 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Endereço
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>CEP</label>
            <input
              name="cep"
              type="text"
              placeholder="00000-000"
              maxLength={9}
              className={inputCls}
              onChange={(e) => onCepChange(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Número</label>
            <input name="numero" type="text" value={undefined} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Rua / Logradouro</label>
            <input
              name="rua"
              type="text"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Bairro</label>
            <input
              name="bairro"
              type="text"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Complemento</label>
            <input name="complemento" type="text" placeholder="Apto, sala…" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cidade</label>
            <input
              name="cidade"
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>UF</label>
            <input
              name="uf"
              type="text"
              maxLength={2}
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase())}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {erro && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-brand-500 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-400 disabled:opacity-50"
      >
        {pending ? "Criando conta…" : "Criar conta"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Componente principal com tabs
// ---------------------------------------------------------------------------
export function AuthTabs({ defaultTab, next }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  return (
    <div className="w-full max-w-[520px]">
      {/* Tabs */}
      <div className="mb-6 flex border-b border-zinc-200">
        {(["entrar", "cadastro"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide transition ${
              tab === t
                ? "border-b-2 border-brand-500 text-brand-600"
                : "text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {t === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      {tab === "entrar" ? (
        <LoginForm next={next} />
      ) : (
        <CadastroForm next={next} />
      )}
    </div>
  );
}
