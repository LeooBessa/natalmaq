"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/admin/dashboard");

  if (!email || !password) {
    return { error: "Preencha e-mail e senha." };
  }

  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciais inválidas." };
  }

  // Confere se o usuário é admin ativo (RLS-friendly: SELECT no próprio row)
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: "Sessão não criada." };

  const { data: admin } = await sb
    .from("admins")
    .select("id, ativo")
    .eq("id", user.id)
    .maybeSingle();

  if (!admin || !admin.ativo) {
    await sb.auth.signOut();
    return {
      error: "Esta conta não está habilitada como administrador.",
    };
  }

  redirect(redirectTo as never);
}

export async function logoutAction(): Promise<void> {
  const sb = await createSupabaseServerClient();
  await sb.auth.signOut();
  redirect("/admin/login");
}
