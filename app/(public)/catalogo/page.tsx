import Link from "next/link";

import { ProductCard } from "@/components/catalog/ProductCard";
import { MobileFilterDrawer } from "@/components/catalog/MobileFilterDrawer";
import { listCategorias, listMarcas, listProdutos } from "@/lib/data";

export const revalidate = 60;

type SearchParams = Promise<{
  q?: string;
  categoria?: string;
  marca?: string;
  page?: string;
  promocao?: string;
  estoque?: string;
}>;

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1) || 1;
  const promocao = sp.promocao === "1";
  const em_estoque = sp.estoque === "1";

  const [produtos, marcas, categorias] = await Promise.all([
    listProdutos({
      q: sp.q,
      categoria: sp.categoria,
      marca: sp.marca,
      page,
      promocao,
      em_estoque,
    }),
    listMarcas(),
    listCategorias(),
  ]);

  const catAtual = categorias.find((c) => c.slug === sp.categoria);
  const marcaAtual = marcas.find((m) => m.slug === sp.marca);

  return (
    <div className="bg-bone">
      {/* Breadcrumb header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <div className="font-mono text-[11px] uppercase tracking-mono text-ink-2">
            NATALMAQ / CATÁLOGO
            {catAtual && ` / ${catAtual.nome.toUpperCase()}`}
            {marcaAtual && ` / ${marcaAtual.nome.toUpperCase()}`}
            {promocao && " / PROMOÇÕES"}
            {em_estoque && " / EM ESTOQUE"}
            {sp.q && ` / BUSCA: "${sp.q.toUpperCase()}"`}
          </div>
          <h1 className="mt-3 font-display text-[28px] tracking-tight text-ink md:text-[36px]">
            {sp.q
              ? `Resultados para “${sp.q}”`
              : promocao
                ? "Promoções"
                : em_estoque
                  ? "Em estoque"
                  : catAtual?.nome ||
                    marcaAtual?.nome ||
                    "Catálogo Completo"}
          </h1>
          <div className="mt-1 text-sm text-ink-2">
            {produtos.total} produto{produtos.total !== 1 && "s"}
          </div>

          {/* Active filter chips */}
          {(catAtual || marcaAtual || promocao || em_estoque || sp.q) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {catAtual && (
                <FilterChip
                  label={catAtual.nome}
                  removeHref={buildHref(sp, { categoria: undefined })}
                />
              )}
              {marcaAtual && (
                <FilterChip
                  label={marcaAtual.nome}
                  removeHref={buildHref(sp, { marca: undefined })}
                />
              )}
              {promocao && (
                <FilterChip
                  label="Promoções"
                  removeHref={buildHref(sp, { promocao: undefined })}
                />
              )}
              {em_estoque && (
                <FilterChip
                  label="Em estoque"
                  removeHref={buildHref(sp, { estoque: undefined })}
                />
              )}
              {sp.q && (
                <FilterChip
                  label={`"${sp.q}"`}
                  removeHref={buildHref(sp, { q: undefined })}
                />
              )}
              <Link
                href="/catalogo"
                className="ml-2 self-center font-mono text-[11px] uppercase tracking-mono text-ink-2 hover:text-brand-500"
              >
                Limpar tudo
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-0 md:grid md:grid-cols-[260px_1fr]">
        {/* Filter rail */}
        <aside className="hidden border-r border-line bg-white p-6 md:block">
          <FilterGroup title="Disponibilidade">
            <FilterLink
              label="Em estoque"
              href={buildHref(sp, {
                estoque: em_estoque ? undefined : "1",
              })}
              checked={em_estoque}
            />
            <FilterLink
              label="Em promoção"
              href={buildHref(sp, {
                promocao: promocao ? undefined : "1",
              })}
              checked={promocao}
            />
          </FilterGroup>

          <FilterGroup title="Categoria">
            {categorias.slice(0, 14).map((c) => (
              <FilterLink
                key={c.id}
                label={c.nome}
                href={buildHref(sp, {
                  categoria: sp.categoria === c.slug ? undefined : c.slug,
                })}
                checked={sp.categoria === c.slug}
              />
            ))}
            {categorias.length > 14 && (
              <FilterLink label={`+ ${categorias.length - 14} categorias`} href="/catalogo" muted />
            )}
          </FilterGroup>

          <FilterGroup title="Marca">
            {marcas.slice(0, 14).map((m) => (
              <FilterLink
                key={m.id}
                label={m.nome}
                href={buildHref(sp, {
                  marca: sp.marca === m.slug ? undefined : m.slug,
                })}
                checked={sp.marca === m.slug}
              />
            ))}
          </FilterGroup>
        </aside>

        {/* Listing */}
        <div className="p-6">
          {/* Mobile filter drawer trigger */}
          <div className="mb-4 md:hidden">
            <MobileFilterDrawer
              categorias={categorias}
              marcas={marcas}
              sp={sp}
              totalAtivos={
                (sp.categoria ? 1 : 0) +
                (sp.marca ? 1 : 0) +
                (sp.promocao ? 1 : 0) +
                (sp.estoque ? 1 : 0) +
                (sp.q ? 1 : 0)
              }
            />
          </div>

          {produtos.items.length === 0 ? (
            <div className="border border-dashed border-line bg-white p-16 text-center">
              <div className="font-mono text-[12px] uppercase tracking-mono text-ink-2">
                NENHUM RESULTADO
              </div>
              <div className="mt-2 text-ink">
                Tente outra busca ou explore as categorias.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-3">
              {produtos.items.map((p) => (
                <ProductCard key={p.id} produto={p} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {(() => {
            const PAGE_SIZE = 24;
            const totalPaginas = Math.ceil(produtos.total / PAGE_SIZE);
            if (totalPaginas <= 1) return null;

            const paginas: number[] = [];
            for (let i = 1; i <= totalPaginas; i++) {
              if (i === 1 || i === totalPaginas || Math.abs(i - page) <= 1) {
                paginas.push(i);
              }
            }

            const comEllipsis: (number | "...")[] = [];
            let prev: number | null = null;
            for (const p of paginas) {
              if (prev !== null && p - prev > 1) comEllipsis.push("...");
              comEllipsis.push(p);
              prev = p;
            }

            return (
              <div className="mt-8 flex items-center justify-center gap-1 font-mono text-sm">
                {page > 1 && (
                  <Link
                    href={{ pathname: "/catalogo", query: { ...sp, page: page - 1 } }}
                    className="border border-line bg-white px-3 py-2 text-ink hover:bg-bone"
                  >
                    ←
                  </Link>
                )}
                {comEllipsis.map((item, i) =>
                  item === "..." ? (
                    <span key={`e-${i}`} className="px-2 py-2 text-ink-2">…</span>
                  ) : (
                    <Link
                      key={item}
                      href={{ pathname: "/catalogo", query: { ...sp, page: item } }}
                      className={`border px-3 py-2 ${
                        item === page
                          ? "border-navy bg-navy text-white"
                          : "border-line bg-white text-ink hover:bg-bone"
                      }`}
                    >
                      {item}
                    </Link>
                  )
                )}
                {page < totalPaginas && (
                  <Link
                    href={{ pathname: "/catalogo", query: { ...sp, page: page + 1 } }}
                    className="border border-line bg-white px-3 py-2 text-ink hover:bg-bone"
                  >
                    →
                  </Link>
                )}
                <span className="ml-3 text-[11px] uppercase tracking-mono text-ink-2">
                  Pág. {page} de {totalPaginas}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="mb-3 border-b-2 border-navy pb-2 font-mono text-[11px] font-bold uppercase tracking-mono text-ink">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilterLink({
  label,
  href,
  checked,
  muted,
}: {
  label: string;
  href: string;
  checked?: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={href as never}
      className={`flex items-center gap-2 py-1 text-[13px] ${
        muted
          ? "text-ink-2 hover:text-brand-500"
          : checked
            ? "font-semibold text-navy"
            : "text-ink hover:text-brand-500"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center border-[1.5px] ${checked ? "border-navy bg-navy text-white" : "border-navy bg-white"}`}
      >
        {checked && <span className="text-[8px]">✓</span>}
      </span>
      <span className="flex-1">{label}</span>
    </Link>
  );
}

function FilterChip({
  label,
  removeHref,
}: {
  label: string;
  removeHref: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 bg-navy px-3 py-1.5 text-[12px] text-white">
      {label}
      <Link
        href={removeHref as never}
        aria-label={`Remover filtro ${label}`}
        className="text-white/70 hover:text-white"
      >
        ×
      </Link>
    </span>
  );
}

/** Constrói uma URL pra /catalogo preservando todos os params SearchParams,
 *  mas com chaves específicas removidas/sobrescritas. */
function buildHref(
  sp: Record<string, string | undefined>,
  override: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...sp, ...override };
  for (const [k, v] of Object.entries(merged)) {
    if (v && k !== "page") params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}
