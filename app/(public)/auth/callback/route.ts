import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // usa || para tratar string vazia
  const next = searchParams.get("next") || "/minha-conta";
  // Recovery SEMPRE termina no formulário de nova senha, nunca em /minha-conta:
  // o link de reset loga o usuário, então cair no destino padrão o deixaria
  // dentro da conta sem nenhuma opção de redefinir a senha.
  const destino = type === "recovery" ? "/auth/nova-senha" : next;

  const sb = await createSupabaseServerClient();

  if (token_hash && type) {
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }

  return NextResponse.redirect(`${origin}/auth?erro=link_invalido`);
}
