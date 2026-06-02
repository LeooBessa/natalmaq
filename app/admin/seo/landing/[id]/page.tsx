import Link from "next/link";
import { notFound } from "next/navigation";

import type { ArticleBlock } from "@/lib/articles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FaqItem } from "../../_components/FaqRepeater";
import { loadLandingRefs } from "../_refs";
import { LandingEditor, type LandingFormValue } from "./LandingEditor";

// Editor de landing existente (molde: app/admin/produtos/[id]). Carrega a landing
// + referências (produtos/categorias/marcas/clusters) e mapeia a row para o
// shape do editor. force-dynamic + try/catch: sem a tabela, devolve null → 404.

export const dynamic = "force-dynamic";

type LandingRow = {
  id: string;
  slug: string | null;
  titulo: string | null;
  subtitulo: string | null;
  cidade: string | null;
  uf: string | null;
  publico: string | null;
  hero_imagem: string | null;
  corpo: unknown;
  produtos_destaque: unknown;
  categoria_id: string | null;
  marca_id: string | null;
  cluster_id: string | null;
  meta_title: string | null;
  meta_description: string | null;
  faq: unknown;
  status: string | null;
};

async function carregarLanding(id: string): Promise<LandingRow | null> {
  try {
    const sb = await createSupabaseServerClient();
    const { data, error } = await sb
      .from("landing_pages")
      .select(
        "id, slug, titulo, subtitulo, cidade, uf, publico, hero_imagem, corpo, produtos_destaque, categoria_id, marca_id, cluster_id, meta_title, meta_description, faq, status",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return null;
    return (data as unknown as LandingRow) ?? null;
  } catch {
    return null;
  }
}

function asBlocks(value: unknown): ArticleBlock[] {
  return Array.isArray(value) ? (value as ArticleBlock[]) : [];
}
function asFaq(value: unknown): FaqItem[] {
  return Array.isArray(value) ? (value as FaqItem[]) : [];
}
function asIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}
function asStatus(value: string | null): LandingFormValue["status"] {
  return value === "publicado" || value === "arquivado" ? value : "rascunho";
}

export default async function EditLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row, refs] = await Promise.all([carregarLanding(id), loadLandingRefs()]);
  if (!row) notFound();

  const landing: LandingFormValue = {
    id: row.id,
    slug: row.slug ?? "",
    titulo: row.titulo ?? "",
    subtitulo: row.subtitulo ?? "",
    metaTitle: row.meta_title ?? "",
    metaDescription: row.meta_description ?? "",
    primaryKeyword: "",
    cidade: row.cidade ?? "",
    uf: row.uf ?? "",
    publico: row.publico ?? "",
    heroImagem: row.hero_imagem ?? "",
    corpo: asBlocks(row.corpo),
    produtosDestaque: asIds(row.produtos_destaque),
    categoriaId: row.categoria_id ?? "",
    marcaId: row.marca_id ?? "",
    clusterId: row.cluster_id ?? "",
    faq: asFaq(row.faq),
    status: asStatus(row.status),
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/seo/landing"
        className="text-sm text-brand-600 hover:underline"
      >
        ← Landing pages
      </Link>
      <div>
        <h1 className="text-2xl font-bold">
          {landing.titulo || "(sem título)"}
        </h1>
        <p className="text-sm text-zinc-500">
          Slug <span className="font-mono">/solucoes/{landing.slug || "—"}</span>
        </p>
      </div>
      <LandingEditor
        landing={landing}
        produtos={refs.produtos}
        categorias={refs.categorias}
        marcas={refs.marcas}
        clusters={refs.clusters}
      />
    </div>
  );
}
