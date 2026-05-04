import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Endereco } from "@/types";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/auth?next=/checkout");

  const { data: cliente } = await sb
    .from("clientes")
    .select("nome, contato, email, endereco")
    .eq("id", user.id)
    .maybeSingle();

  const clienteBasico = cliente
    ? {
        nome: cliente.nome as string,
        contato: cliente.contato as string,
        email: cliente.email as string,
        endereco: (cliente.endereco as Endereco) ?? null,
      }
    : null;

  return <CheckoutForm userId={user.id} cliente={clienteBasico} />;
}
