import Link from "next/link";

import { BannerCarousel } from "@/components/home/BannerCarousel";
import { ProductCard } from "@/components/catalog/ProductCard";
import { listBanners, listCategorias, listMarcas, listProdutos } from "@/lib/data";

export const revalidate = 60;

export default async function HomePage() {
  const [banners, destaques, categorias, marcas] = await Promise.all([
    listBanners(),
    listProdutos({ page: 1 }),
    listCategorias(),
    listMarcas(),
  ]);

  const destaquesItems = destaques.items.slice(0, 8);
  const catTop = categorias.slice(0, 8);

  return (
    <div>
      {/* BANNERS ─────────────────────────────────────────── */}
      <BannerCarousel banners={banners} />

      {/* HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="absolute inset-0 bg-hatch-orange" />
        <div className="relative mx-auto max-w-[1280px] px-6 py-16 md:py-20 md:px-10">
          <div className="mb-5 flex items-center gap-3 font-mono text-[11px] uppercase tracking-mono text-brand-400">
            <span className="block h-px w-8 bg-brand-500" />
            EDIÇÃO 2026 · CATÁLOGO INDUSTRIAL
          </div>
          <h1 className="font-display text-[42px] leading-[0.95] tracking-tight md:text-[64px] lg:text-[72px]">
            FERRAMENTAS
            <br />
            QUE <span className="text-brand-500">NÃO PARAM</span>
            <br />
            A SUA OBRA.
          </h1>
          <p className="mt-6 max-w-[560px] text-[15px] leading-relaxed text-white/70">
            Mais de 1.600 SKUs em estoque. Marcas profissionais, atendimento
            técnico e orçamento em até 2 horas para construtoras, indústrias e
            prestadores de serviço.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/catalogo"
              className="bg-brand-500 px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-brand-400"
            >
              Explorar catálogo →
            </Link>
            <Link
              href="/carrinho"
              className="border border-white/40 px-7 py-4 text-sm text-white hover:bg-white/10"
            >
              Solicitar orçamento em volume
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-0 border-t border-white/15 pt-6 md:grid-cols-4">
            {[
              ["1.670+", "SKUs ATIVOS"],
              ["18 ANOS", "NO MERCADO"],
              ["2H", "COTAÇÃO MÉDIA"],
              ["98%", "ENTREGA NO PRAZO"],
            ].map(([n, l], i) => (
              <div
                key={l}
                className={i < 3 ? "border-r border-white/15 pr-4" : "pr-4"}
              >
                <div className="font-display text-[26px] tracking-tight text-brand-400">
                  {n}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-mono text-white/60">
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIAS ───────────────────────────────────────── */}
      {catTop.length > 0 && (
        <section className="border-b border-line bg-bone py-16">
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-mono text-brand-500">
                  01 · CATEGORIAS
                </div>
                <h2 className="mt-2 font-display text-[32px] leading-[0.95] tracking-tight text-ink md:text-[44px]">
                  NAVEGUE POR DEPARTAMENTO
                </h2>
              </div>
              <Link
                href="/catalogo"
                className="border-b-2 border-brand-500 pb-1 font-mono text-[12px] uppercase tracking-mono text-ink hover:text-brand-500"
              >
                VER TODOS OS PRODUTOS →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
              {catTop.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/catalogo?categoria=${c.slug}`}
                  className="group flex min-h-[140px] flex-col justify-between bg-white p-5 transition hover:bg-bone"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center bg-navy font-mono text-[10px] text-white">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div>
                    <div className="text-[15px] font-bold leading-tight text-ink group-hover:text-brand-500">
                      {c.nome}
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-mono text-ink-2">
                      ver produtos →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DESTAQUES ────────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-[1280px] px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-mono text-brand-500">
                02 · LINHA PROFISSIONAL
              </div>
              <h2 className="mt-2 font-display text-[32px] leading-[0.95] tracking-tight text-ink md:text-[44px]">
                DESTAQUES DA SEMANA
              </h2>
            </div>
            <Link
              href="/catalogo"
              className="font-mono text-[12px] uppercase tracking-mono text-ink-2 hover:text-brand-500"
            >
              Ver tudo →
            </Link>
          </div>

          {destaquesItems.length === 0 ? (
            <div className="border border-dashed border-line bg-bone p-12 text-center font-mono text-[12px] uppercase tracking-mono text-ink-2">
              Nenhum produto cadastrado ainda — importe um PDF em /admin/importar
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {destaquesItems.map((p) => (
                <ProductCard key={p.id} produto={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MARCAS ───────────────────────────────────────────── */}
      {marcas.length > 0 && (
        <section className="border-y border-line bg-bone py-12">
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="mb-6 font-mono text-[11px] uppercase tracking-mono text-ink-2">
              03 · MARCAS PARCEIRAS
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              {marcas.slice(0, 12).map((m) => (
                <Link
                  key={m.id}
                  href={`/marca/${m.slug}`}
                  className="font-display text-[20px] tracking-tight text-ink-2 transition hover:text-ink"
                >
                  {m.nome.toUpperCase()}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA STRIP ────────────────────────────────────────── */}
      <section className="bg-navy py-12 text-white">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-6 md:grid-cols-3">
          {[
            [
              "ORÇAMENTO B2B",
              "Cadastre seu CNPJ e receba condições especiais para volume.",
              "Solicitar orçamento →",
              "/carrinho",
            ],
            [
              "ENTREGA EM TODO RN",
              "Frota própria com saída diária para Natal e região metropolitana.",
              "Calcular frete →",
              "/checkout",
            ],
            [
              "ASSISTÊNCIA TÉCNICA",
              "Reparo autorizado das principais marcas em nosso galpão.",
              "Solicitar serviço →",
              "/institucional",
            ],
          ].map(([t, d, a, h]) => (
            <Link
              key={t}
              href={h as never}
              className="block border-l-2 border-brand-500 pl-5"
            >
              <div className="font-mono text-[11px] uppercase tracking-mono text-brand-400">
                {t}
              </div>
              <div className="mt-2 text-[15px] leading-relaxed text-white/85">
                {d}
              </div>
              <div className="mt-4 inline-block border-b border-brand-500 pb-0.5 text-[13px] text-white">
                {a}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
