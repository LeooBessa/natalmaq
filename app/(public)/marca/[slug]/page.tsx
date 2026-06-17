import { notFound } from "next/navigation";

import { ProductCard } from "@/components/catalog/ProductCard";
import { listMarcas, listProdutos } from "@/lib/data";

export const revalidate = 60;

export default async function MarcaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [marcas, produtos] = await Promise.all([
    listMarcas(),
    listProdutos({ marca: slug }),
  ]);

  const marca = marcas.find((m) => m.slug === slug);
  if (!marca) notFound();

  return (
    <div className="bg-bone">
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-6">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / MARCA / {marca.nome.toUpperCase()}
          </div>
          <h1 className="mt-3 font-display text-[32px] tracking-tight text-ink md:text-[40px]">
            {marca.nome}
          </h1>
          <div className="mt-1 text-sm text-ink-2">
            {produtos.total} produto{produtos.total !== 1 && "s"} desta marca
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 md:px-6 py-8">
        {produtos.items.length === 0 ? (
          <div className="border border-dashed border-line bg-white p-16 text-center font-mono text-[12px] uppercase tracking-mono text-ink-2">
            Nenhum produto cadastrado para esta marca.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {produtos.items.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
