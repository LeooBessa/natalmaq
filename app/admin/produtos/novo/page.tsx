import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProdutoForm } from "../ProdutoForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo produto" };

export default async function NovoProdutoPage() {
  const sb = await createSupabaseServerClient();
  const [{ data: marcas }, { data: categorias }] = await Promise.all([
    sb.from("marcas").select("id, nome").order("nome"),
    sb.from("categorias").select("id, nome").order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/produtos" className="text-sm text-brand-600 hover:underline">
        ← Produtos
      </Link>
      <h1 className="text-2xl font-bold">Novo produto</h1>
      <ProdutoForm
        produto={{
          codigo: "",
          slug: "",
          nome: "",
          descricao: null,
          marca_id: null,
          categoria_id: null,
          preco: 0,
          preco_promocional: null,
          estoque: 0,
          peso_kg: 0,
          ativo: true,
          destaque: false,
          imagens: [],
        }}
        marcas={marcas ?? []}
        categorias={categorias ?? []}
      />
    </div>
  );
}
