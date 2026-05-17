import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // usa || para tratar string vazia; recovery sempre vai para nova-senha
  const next = searchParams.get("next") || "/minha-conta";

  const sb = await createSupabaseServerClient();

  if (token_hash && type) {
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) {
      const dest = type === "recovery" ? "/auth/nova-senha" : next;
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth?erro=link_invalido`);
}
