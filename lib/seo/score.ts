// SEO score determinístico (doc 02 §6). Função PURA: roda sobre os campos do
// artigo e devolve { score: 0..100, checks: SeoCheck[] }. Usada no admin (Fase 3)
// como barra + lista de itens; orientativo (não bloqueia publicação).
//
// Nota de tipos reais: ArticleBlock = heading|paragraph|list (sem faq/step).
// FAQ é um campo ESTRUTURADO separado (faq: {question,answer}[]), passado à
// parte. A keyword principal é keywords[0].

import type { ArticleBlock } from "@/lib/articles";
import { normalizePt } from "./normalize";

export type SeoCheck = {
  id: string;
  label: string;
  ok: boolean;
  weight: number;
  hint?: string;
};

export type ScoreArtigoInput = {
  titulo: string;
  excerpt: string;
  keywords: string[];
  conteudo: ArticleBlock[];
  imagemAlt?: string;
  slug: string;
  faq?: { question: string; answer: string }[];
};

export function scoreArtigo(input: ScoreArtigoInput): {
  score: number;
  checks: SeoCheck[];
} {
  const checks: SeoCheck[] = [];
  const add = (
    id: string,
    label: string,
    ok: boolean,
    weight: number,
    hint?: string,
  ) => checks.push({ id, label, ok, weight, hint });

  const kw = normalizePt(input.keywords[0] ?? "");
  const kwHead = kw.split(" ")[0] ?? "";
  const headings = input.conteudo.filter((b) => b.type === "heading");

  // Texto plano do corpo (paragraph + items de list).
  const text = input.conteudo
    .flatMap((b) =>
      b.type === "paragraph" ? [b.text] : b.type === "list" ? b.items : [],
    )
    .join(" ");
  const normText = normalizePt(text);
  const words = normText.split(" ").filter(Boolean);

  const density = kwHead
    ? words.filter((w) => w.includes(kwHead)).length / Math.max(words.length, 1)
    : 0;

  // 1. Title length 30-60
  add(
    "title-len",
    "Título 30-60 caracteres",
    input.titulo.length >= 30 && input.titulo.length <= 60,
    8,
  );
  // 2. Meta description 110-160
  add(
    "desc-len",
    "Meta descrição 110-160 caracteres",
    input.excerpt.length >= 110 && input.excerpt.length <= 160,
    8,
  );
  // 3. Keyword no título
  add(
    "kw-title",
    "Palavra-chave no título",
    !!kw && normalizePt(input.titulo).includes(kw),
    8,
  );
  // 4. Keyword no 1º parágrafo (~150 chars iniciais)
  add(
    "kw-first",
    "Palavra-chave no 1º parágrafo",
    !!kw && normText.slice(0, 150).includes(kw),
    8,
  );
  // 5. Densidade 0.4%-2.5%
  add(
    "kw-density",
    "Densidade da palavra-chave 0,4%-2,5%",
    density >= 0.004 && density <= 0.025,
    8,
    density > 0.03 ? "Keyword stuffing: reduza repetições." : undefined,
  );
  // 6. >= 2 H2 (todo heading vira H2 no render)
  add("h2", "Pelo menos 2 subtítulos (H2)", headings.length >= 2, 8);
  // 7. Hierarquia/TOC viável (>= 3 H2 gera índice)
  add("toc", "Pelo menos 3 H2 (índice viável)", headings.length >= 3, 3);
  // 8. Alt de imagem
  add(
    "alt",
    "Alt de imagem (5-125 chars)",
    !!input.imagemAlt &&
      input.imagemAlt.length >= 5 &&
      input.imagemAlt.length <= 125 &&
      normalizePt(input.imagemAlt) !== normalizePt(input.titulo),
    6,
  );
  // 9. Conteúdo >= 600 palavras
  add("words", "Conteúdo com 600+ palavras", words.length >= 600, 6);
  // 10. Parágrafos curtos (nenhum > 100 palavras)
  const longPara = input.conteudo.some(
    (b) => b.type === "paragraph" && b.text.split(/\s+/).filter(Boolean).length > 100,
  );
  add(
    "short-paras",
    "Parágrafos curtos (< 100 palavras)",
    !longPara,
    5,
    longPara ? "Quebre parágrafos longos para legibilidade/IA." : undefined,
  );
  // 11. FAQ (>= 2) habilita FAQPage
  add(
    "faq",
    "FAQ no fim (2+ perguntas)",
    (input.faq?.length ?? 0) >= 2,
    6,
  );
  // 12. Slug saudável (kebab-case, <= 80 chars)
  add(
    "slug",
    "Slug saudável (kebab-case, <= 80 chars)",
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) && input.slug.length <= 80,
    4,
  );

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const got = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  return { score: total ? Math.round((got / total) * 100) : 0, checks };
}
