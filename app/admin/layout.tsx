import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logoutAction } from "./login/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  // Se não está logado, mostra layout limpo (login só)
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
      </div>
    );
  }

  const { data: admin } = await sb
    .from("admins")
    .select("nome, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white md:block">
        <div className="border-b border-zinc-200 p-4">
          <Link href="/admin/dashboard" className="text-lg font-extrabold text-brand-600">
            Natalmaq
          </Link>
          <p className="text-xs text-zinc-500">Painel administrativo</p>
        </div>

        <nav className="flex flex-col gap-1 p-3 text-sm">
          <NavLink href="/admin/dashboard">Dashboard</NavLink>
          <NavLink href="/admin/pedidos">Pedidos</NavLink>
          <NavLink href="/admin/produtos">Produtos</NavLink>
          <NavLink href="/admin/marcas">Marcas</NavLink>
          <NavLink href="/admin/categorias">Categorias</NavLink>
          <NavLink href="/admin/banners">Banners</NavLink>
          <NavLink href="/admin/cupons">Cupons</NavLink>
          <hr className="my-2 border-zinc-200" />
          <NavLink href="/admin/importar">Importar planilha</NavLink>
          <NavLink href="/admin/importar-fotos">Importar fotos PDF</NavLink>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
          <div className="text-sm">
            <span className="font-semibold text-zinc-900">
              {admin?.nome ?? user.email}
            </span>
            <span className="ml-2 rounded bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
              {admin?.role ?? "admin"}
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm font-medium text-zinc-600 hover:text-brand-600"
            >
              Sair
            </button>
          </form>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as never}
      className="rounded-md px-3 py-2 text-zinc-700 transition hover:bg-zinc-100 hover:text-brand-600"
    >
      {children}
    </Link>
  );
}
