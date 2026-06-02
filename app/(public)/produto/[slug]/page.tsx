import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/ProductCard";
import { ProdutoComVariantes } from "@/components/produto/ProdutoComVariantes";
import { ProdutoGallery } from "@/components/produto/ProdutoGallery";
import { getProdutoBySlug } from "@/lib/data";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, productNode, storeNode } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const produto = await getProdutoBySlug(slug);
  if (!produto) {
    return { title: "Produto não encontrado" };
  }

  return buildMetadata({
    title: produto.nome,
    description:
      produto.descricao ??
      `${produto.nome}${produto.marca ? ` ${produto.marca.nome}` : ""}. Orçamento rápido por WhatsApp na Natalmaq, Natal/RN.`,
    path: `/produto/${produto.slug}`,
    image: produto.imagens?.[0],
    type: "website",
  });
}

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const produto = await getProdutoBySlug(slug);
  if (!produto) notFound();

  const jsonLd = [
    productNode(produto),
    breadcrumbNode([
      { name: "Início", path: "/" },
      { name: "Catálogo", path: "/catalogo" },
      ...(produto.marca
        ? [{ name: produto.marca.nome, path: `/marca/${produto.marca.slug}` }]
        : []),
      { name: produto.codigo, path: `/produto/${produto.slug}` },
    ]),
    storeNode(),
  ];

  return (
    <div className="bg-bone">
      <JsonLd data={jsonLd} />
      {/* Breadcrumb */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-4 font-mono text-[11px] uppercase tracking-mono text-ink-2">
          <Link href="/" className="hover:text-brand-500">
            NATALMAQ
          </Link>
          {" / "}
          <Link href="/catalogo" className="hover:text-brand-500">
            CATÁLOGO
          </Link>
          {produto.marca && (
            <>
              {" / "}
              <Link
                href={`/marca/${produto.marca.slug}`}
                className="hover:text-brand-500"
              >
                {produto.marca.nome.toUpperCase()}
              </Link>
            </>
          )}
          {" / "}
          <span className="text-ink">{produto.codigo}</span>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-8 px-6 py-10 md:grid-cols-[1.1fr_1fr]">
        {/* Gallery */}
        <div>
          <ProdutoGallery
            imagens={produto.imagens ?? []}
            nome={produto.nome}
            codigo={produto.codigo}
          />
        </div>

        {/* Info — variantes + preço + CTA */}
        <ProdutoComVariantes
          produto={produto}
          variantes={produto.variantes}
        />
      </div>

      {/* Specs strip */}
      <div className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-px bg-line md:grid-cols-4">
          {[
            ["ENTREGA", "Calcular CEP no checkout"],
            ["GARANTIA", "Conforme fabricante"],
            ["NOTA FISCAL", "CNPJ ou CPF"],
            ["CONTATO", "WhatsApp em 2h úteis"],
          ].map(([k, v]) => (
            <div key={k} className="bg-white p-5">
              <div className="font-mono text-[10px] uppercase tracking-mono text-ink-2">
                {k}
              </div>
              <div className="mt-1 text-sm font-semibold text-ink">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {produto.complementares_produtos.length > 0 && (
        <section className="bg-bone py-14">
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="mb-6 font-mono text-[11px] uppercase tracking-mono text-brand-500">
              COMPLETE SUA COMPRA
            </div>
            <h2 className="mb-6 font-display text-[28px] tracking-tight text-ink">
              ITENS COMPLEMENTARES
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {produto.complementares_produtos.map((p) => (
                <ProductCard key={p.id} produto={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
