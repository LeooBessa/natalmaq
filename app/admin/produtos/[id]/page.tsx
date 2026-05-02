import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProdutoForm } from "../ProdutoForm";

export const dynamic = "force-dynamic";

export default async function EditProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await createSupabaseServerClient();

  const [{ data: produto }, { data: marcas }, { data: categorias }] =
    await Promise.all([
      sb.from("produtos").select("*").eq("id", id).maybeSingle(),
      sb.from("marcas").select("id, nome").order("nome"),
      sb.from("categorias").select("id, nome").order("nome"),
    ]);

  if (!produto) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/produtos" className="text-sm text-brand-600 hover:underline">
        ← Produtos
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{produto.nome}</h1>
        <p className="text-sm text-zinc-500">
          Código <span className="font-mono">{produto.codigo}</span> • Slug{" "}
          <span className="font-mono">{produto.slug}</span>
        </p>
      </div>
      <ProdutoForm
        produto={{
          ...produto,
          imagens: Array.isArray(produto.imagens) ? produto.imagens : [],
        }}
        marcas={marcas ?? []}
        categorias={categorias ?? []}
      />
    </div>
  );
}
