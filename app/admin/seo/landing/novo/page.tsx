import Link from "next/link";

import { loadLandingRefs } from "../_refs";
import { LandingEditor, type LandingFormValue } from "../[id]/LandingEditor";

// Nova landing page (molde: app/admin/produtos/novo). createLandingAction
// redireciona para /admin/seo/landing/[id] após inserir.

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova landing page" };

const VAZIO: LandingFormValue = {
  slug: "",
  titulo: "",
  subtitulo: "",
  metaTitle: "",
  metaDescription: "",
  primaryKeyword: "",
  cidade: "Natal",
  uf: "RN",
  publico: "",
  heroImagem: "",
  corpo: [],
  produtosDestaque: [],
  categoriaId: "",
  marcaId: "",
  clusterId: "",
  faq: [],
  status: "rascunho",
};

export default async function NovaLandingPage() {
  const { produtos, categorias, marcas, clusters } = await loadLandingRefs();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/seo/landing"
        className="text-sm text-brand-600 hover:underline"
      >
        ← Landing pages
      </Link>
      <h1 className="text-2xl font-bold">Nova landing page</h1>
      <LandingEditor
        landing={VAZIO}
        produtos={produtos}
        categorias={categorias}
        marcas={marcas}
        clusters={clusters}
      />
    </div>
  );
}
