"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Endereco } from "@/types";

import { SITE_URL } from "@/lib/site-url";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export async function loginAction(
  formData: FormData,
): Promise<{ ok: false; error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const next = String(formData.get("next") || "/minha-conta");

  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });

  if (error) return { ok: false, error: "E-mail ou senha inválidos." };

  redirect(next);
}

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------
export async function cadastroAction(
  formData: FormData,
): Promise<{ ok: false; error: string } | { ok: true; confirmar: boolean }> {
  const email   = String(formData.get("email")   ?? "").trim();
  const senha   = String(formData.get("senha")   ?? "");
  const nome    = String(formData.get("nome")    ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim();
  const next    = String(formData.get("next")    || "/minha-conta");

  if (!email || !senha || !nome || !contato) {
    return { ok: false, error: "Preencha todos os campos obrigatórios." };
  }
  if (senha.length < 6) {
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };
  }

  const endereco: Endereco = {
    cep:         String(formData.get("cep")   ?? "").replace(/\D/g, ""),
    rua:         String(formData.get("rua")   ?? "").trim(),
    numero:      String(formData.get("numero") ?? "").trim(),
    bairro:      String(formData.get("bairro") ?? "").trim(),
    cidade:      String(formData.get("cidade") ?? "").trim(),
    uf:          String(formData.get("uf")    ?? "").trim().toUpperCase(),
    complemento: String(formData.get("complemento") ?? "").trim() || undefined,
  };

  const sb = await createSupabaseServerClient();

  const { data: authData, error: authError } = await sb.auth.signUp({
    email,
    password: senha,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (authError) {
    if (authError.message.includes("already registered")) {
      return { ok: false, error: "Este e-mail já está cadastrado. Faça login." };
    }
    return { ok: false, error: authError.message };
  }

  if (!authData.user) {
    return { ok: false, error: "Erro ao criar conta. Tente novamente." };
  }

  // Cria perfil na tabela clientes (usa service-role via createSupabaseServerClient)
  const { error: clienteError } = await sb
    .from("clientes")
    .insert({ id: authData.user.id, nome, contato, email, endereco });

  if (clienteError) {
    return { ok: false, error: "Erro ao salvar perfil: " + clienteError.message };
  }

  // Sem confirmação de email → sessão imediata → redireciona
  if (authData.session) {
    redirect(next);
  }

  // Com confirmação de email pendente
  return { ok: true, confirmar: true };
}

// ---------------------------------------------------------------------------
// Recuperar senha
// ---------------------------------------------------------------------------
export async function recuperarSenhaAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const email = String(formData.get("email") ?? "").trim();

  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${SITE_URL}/auth/callback?next=/auth/nova-senha`,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Logout do cliente
// ---------------------------------------------------------------------------
export async function logoutClienteAction() {
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  redirect("/");
}
