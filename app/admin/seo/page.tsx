import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  FileEdit,
  Gauge,
  Plus,
  AlertTriangle,
  Network,
  Database,
} from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scoreArtigo } from "@/lib/seo/score";
import type { ArticleBlock } from "@/lib/articles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel SEO" };

// ---------------------------------------------------------------------------
// Tipos das linhas que lemos do banco (subset do que precisamos no painel).
// ---------------------------------------------------------------------------
type ArtigoRow = {
  id: string;
  slug: string;
  titulo: string;
  excerpt: string | null;
  imagem: string | null;
  og_image: string | null;
  corpo: unknown;
  keywords: string[] | null;
  meta_description: string | null;
  cluster_id: string | null;
  eh_pilar: boolean;
  status: string;
  faq: unknown;
  links_inline: unknown;
};

type ClusterRow = {
  id: string;
  slug: string;
  titulo: string;
  artigo_pilar_id: string | null;
  ordem: number;
};

// Cada artigo decorado com o score determinístico calculado no servidor.
type ArtigoComScore = ArtigoRow & {
  score: number;
  metaPreenchida: boolean;
  semLinks: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function asBlocks(corpo: unknown): ArticleBlock[] {
  return Array.isArray(corpo) ? (corpo as ArticleBlock[]) : [];
}

function asFaq(faq: unknown): { question: string; answer: string }[] {
  if (!Array.isArray(faq)) return [];
  // Aceita tanto {question,answer} quanto {pergunta,resposta} (schema do banco).
  return faq.map((f) => {
    const o = (f ?? {}) as Record<string, unknown>;
    return {
      question: String(o.question ?? o.pergunta ?? ""),
      answer: String(o.answer ?? o.resposta ?? ""),
    };
  });
}

function linksAplicados(links: unknown): number {
  return Array.isArray(links) ? links.length : 0;
}

// Faixa de cores da barra de cobertura: >=80 verde, >=40 âmbar, <40 cinza.
function barraCor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-zinc-300";
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default async function PainelSeoPage() {
  const sb = await createSupabaseServerClient();

  // Toda leitura de tabela nova fica em try/catch: se a migration 0019/0020 não
  // foi aplicada (build), a query lança/retorna erro e devolvemos lista vazia —
  // o painel mostra o estado de "aplique a migration" em vez de crashar.
  let artigos: ArtigoRow[] = [];
  let clusters: ClusterRow[] = [];
  let tabelaAusente = false;

  try {
    const { data, error } = await sb
      .from("artigos")
      .select(
        "id, slug, titulo, excerpt, imagem, og_image, corpo, keywords, meta_description, cluster_id, eh_pilar, status, faq, links_inline",
      )
      .order("updated_at", { ascending: false });
    if (error) throw error;
    artigos = (data ?? []) as ArtigoRow[];
  } catch {
    tabelaAusente = true;
  }

  try {
    const { data, error } = await sb
      .from("clusters")
      .select("id, slug, titulo, artigo_pilar_id, ordem")
      .order("ordem", { ascending: true });
    if (error) throw error;
    clusters = (data ?? []) as ClusterRow[];
  } catch {
    // Se artigos existe mas clusters não, ainda mostramos os cards.
    clusters = [];
  }

  // Estado vazio gracioso: nenhuma tabela de conteúdo disponível.
  if (tabelaAusente && clusters.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">
                Conteúdo ainda não disponível
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Aplique a migration de conteúdo (0019) para começar a gerenciar
                artigos, clusters e landing pages. Assim que o banco estiver
                pronto, este painel mostra suas métricas de SEO.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Cálculo do score determinístico (server-side) para cada artigo.
  // -------------------------------------------------------------------------
  const comScore: ArtigoComScore[] = artigos.map((a) => {
    const { score } = scoreArtigo({
      titulo: a.titulo ?? "",
      excerpt: a.excerpt ?? "",
      keywords: a.keywords ?? [],
      conteudo: asBlocks(a.corpo),
      imagemAlt: a.imagem ?? undefined,
      slug: a.slug ?? "",
      faq: asFaq(a.faq),
    });
    const metaPreenchida = !!(a.meta_description ?? a.excerpt ?? "").trim();
    return {
      ...a,
      score,
      metaPreenchida,
      semLinks: linksAplicados(a.links_inline) === 0,
    };
  });

  const total = comScore.length;
  const publicados = comScore.filter((a) => a.status === "publicado").length;
  const rascunhos = comScore.filter((a) => a.status === "rascunho").length;
  const scoreMedio = total
    ? Math.round(comScore.reduce((s, a) => s + a.score, 0) / total)
    : 0;

  // -------------------------------------------------------------------------
  // Cobertura de clusters: por cluster, pilar existe? e X publicados / Y total.
  // -------------------------------------------------------------------------
  const cobertura = clusters.map((c) => {
    const doCluster = comScore.filter((a) => a.cluster_id === c.id);
    const publicadosNoCluster = doCluster.filter(
      (a) => a.status === "publicado",
    ).length;
    const temPilar =
      !!c.artigo_pilar_id || doCluster.some((a) => a.eh_pilar);
    const totalNoCluster = doCluster.length;
    const pct = totalNoCluster
      ? Math.round((publicadosNoCluster / totalNoCluster) * 100)
      : 0;
    return {
      ...c,
      temPilar,
      publicadosNoCluster,
      totalNoCluster,
      pct,
    };
  });

  // -------------------------------------------------------------------------
  // Precisa de atenção: derivado das regras determinísticas.
  // -------------------------------------------------------------------------
  type Atencao = { href: string; texto: string; tom: "red" | "amber" };
  const atencao: Atencao[] = [];

  for (const a of comScore) {
    if (a.score < 50) {
      atencao.push({
        href: `/admin/seo/artigos/${a.id}`,
        texto: `"${a.titulo}" — score baixo (${a.score})`,
        tom: "red",
      });
    } else if (!a.metaPreenchida) {
      atencao.push({
        href: `/admin/seo/artigos/${a.id}`,
        texto: `"${a.titulo}" — sem meta description`,
        tom: "amber",
      });
    } else if (a.semLinks) {
      atencao.push({
        href: `/admin/seo/artigos/${a.id}`,
        texto: `"${a.titulo}" — nenhum link interno aplicado`,
        tom: "amber",
      });
    }
  }

  for (const c of cobertura) {
    if (!c.temPilar) {
      atencao.push({
        href: `/admin/seo/clusters?cluster=${c.slug}`,
        texto: `Cluster "${c.titulo}" — pilar ainda não escrito`,
        tom: "amber",
      });
    }
  }

  return (
    <div className="space-y-6">
      <Header />

      {/* Cards de métrica */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Artigos"
          value={String(total)}
          icon={<FileText className="h-5 w-5 text-zinc-500" />}
          color="border-zinc-200 bg-white"
        />
        <MetricCard
          label="Publicados"
          value={String(publicados)}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          color="border-green-200 bg-green-50"
        />
        <MetricCard
          label="Rascunhos"
          value={String(rascunhos)}
          icon={<FileEdit className="h-5 w-5 text-amber-600" />}
          color="border-amber-200 bg-amber-50"
        />
        <MetricCard
          label="Score médio"
          value={total ? String(scoreMedio) : "—"}
          icon={<Gauge className="h-5 w-5 text-brand-600" />}
          color="border-brand-200 bg-brand-50"
        />
      </div>

      {/* Cobertura de clusters */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="flex items-center gap-2 font-semibold text-zinc-900">
            <Network className="h-4 w-4 text-zinc-400" />
            Cobertura de clusters
            {cobertura.length > 0 && (
              <span className="text-sm font-normal text-zinc-400">
                ({cobertura.length} alvo{cobertura.length !== 1 ? "s" : ""})
              </span>
            )}
          </h2>
          <Link
            href="/admin/seo/clusters"
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            Gerenciar →
          </Link>
        </div>
        <div className="divide-y divide-zinc-100">
          {cobertura.map((c) => (
            <Link
              key={c.id}
              href={`/admin/seo/clusters?cluster=${c.slug}`}
              className="flex items-center gap-4 px-5 py-3 transition hover:bg-zinc-50"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
                {c.titulo}
              </span>
              <span
                className={`shrink-0 text-xs font-semibold ${
                  c.temPilar ? "text-green-600" : "text-red-500"
                }`}
                title={c.temPilar ? "Pilar definido" : "Sem artigo-pilar"}
              >
                pilar {c.temPilar ? "✓" : "✗"}
              </span>
              <span className="w-20 shrink-0 text-right text-xs text-zinc-500">
                {c.publicadosNoCluster}/{c.totalNoCluster} artigos
              </span>
              <span className="hidden h-2 w-28 shrink-0 overflow-hidden rounded-full bg-zinc-100 sm:block">
                <span
                  className={`block h-full rounded-full ${barraCor(c.pct)}`}
                  style={{ width: `${c.pct}%` }}
                />
              </span>
            </Link>
          ))}
          {cobertura.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              Nenhum cluster cadastrado.
            </p>
          )}
        </div>
      </section>

      {/* Precisa de atenção */}
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-3">
          <h2 className="flex items-center gap-2 font-semibold text-zinc-900">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Precisa de atenção
            {atencao.length > 0 && (
              <span className="text-sm font-normal text-zinc-400">
                ({atencao.length})
              </span>
            )}
          </h2>
        </div>
        <div className="divide-y divide-zinc-100">
          {atencao.map((item, i) => (
            <Link
              key={`${item.href}-${i}`}
              href={item.href as never}
              className="flex items-center gap-3 px-5 py-2.5 text-sm transition hover:bg-zinc-50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  item.tom === "red" ? "bg-red-500" : "bg-amber-500"
                }`}
              />
              <span className="min-w-0 flex-1 truncate text-zinc-700">
                {item.texto}
              </span>
              <span className="shrink-0 text-xs font-semibold text-brand-600">
                Editar →
              </span>
            </Link>
          ))}
          {atencao.length === 0 && (
            <div className="flex items-center gap-2 px-5 py-8 text-center text-sm text-zinc-500">
              <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
              <span className="flex-1">
                Tudo em ordem. Nenhum item precisa de atenção.
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------
function Header() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">SEO & Conteúdo</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gerencie artigos, clusters e landing pages do site.
        </p>
      </div>
      <Link
        href="/admin/seo/artigos/novo"
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" />
        Novo artigo
      </Link>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${color}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-zinc-900">{value}</p>
    </div>
  );
}
