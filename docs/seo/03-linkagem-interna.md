# 03 — Motor de Linkagem Interna Automática (custo zero, determinístico)

> Parte 3 do projeto de SEO da Natalmaq.
> Portal B2B de orçamento de ferramentas/máquinas/EPI em Natal/RN (cesta + fechamento via `wa.me`).
> Stack: Next.js 15 (App Router, RSC) + TypeScript + Supabase (Postgres + RLS + tsvector) + FastAPI (`/api`) + Tailwind + Zustand. Deploy Vercel.

Este documento especifica **o motor que automatiza TUDO ao redor do conteúdo** — descoberta e inserção de links internos (artigo↔produto/categoria/marca↔artigo), blocos de "relacionados", e a malha pillar↔cluster. **O texto dos artigos continua humano.** Nenhuma chamada a LLM/API paga em runtime: toda automação é código TypeScript determinístico + SQL no Supabase free tier.

---

## 0. Princípios inegociáveis (recapitulando as restrições)

1. **Custo zero em runtime.** Sem Anthropic/OpenAI/Gemini. Matching é dicionário + normalização pt-BR + tsvector. Supabase free tier OK. Nenhuma dependência paga nova.
2. **Texto = humano.** O sistema gera/insere links, âncoras, blocos, schema, breadcrumb — não escreve o conteúdo.
3. **Conteúdo no Supabase**, editável pelo admin, publica sem novo deploy. Site público lê do Supabase com ISR/`revalidateTag`.
4. **Pré-computar no save** (admin), não no render. O render só lê uma estrutura já resolvida → barato e estável.
5. **PT-BR + design "Indústria"** (navy + laranja, `bg-bone`, `text-ink`, `brand-500`, Archivo Black/JetBrains Mono).

> Premissa de integração: este documento assume que a **Parte 1 (Pillar+Clusters)** moveu os artigos para o Supabase (tabelas `artigos`, `clusters`, `artigo_keywords`) e a **Parte 2 (Schema rico)** definiu os componentes de JSON-LD. Onde houver dependência, está sinalizado com `[dep: Parte 1]` / `[dep: Parte 2]`. Esta Parte 3 é **auto-suficiente**: se as tabelas de artigo ainda não existirem, o motor roda contra `lib/articles.ts` (os 3 artigos atuais) num modo de transição descrito na §9.

---

## 1. O que já existe (auditoria do código)

Antes de projetar, mapeei o terreno. Pontos que o motor reaproveita:

| Recurso existente | Arquivo | Como o motor usa |
|---|---|---|
| Modelo de artigo `Article` / `ArticleBlock = heading\|paragraph\|list` + 3 artigos hardcoded com `keywords[]` | `lib/articles.ts` | Fonte do conteúdo no modo transição; `keywords[]` vira insumo do dicionário. |
| Render do artigo + `generateMetadata` + JSON-LD `Article`+`BreadcrumbList` | `app/(public)/artigos/[slug]/page.tsx` | Ponto de injeção dos links in-content e blocos relacionados; JSON-LD ganha `FAQPage`/`HowTo` `[dep: Parte 2]`. |
| Índice de artigos | `app/(public)/artigos/page.tsx` | Vira `CollectionPage`/`ItemList` `[dep: Parte 2]`; ganha agrupamento por cluster. |
| Sitemap (estáticas + artigos + marcas/categorias do Supabase, `revalidate=3600`) | `app/sitemap.ts` | Passa a ler `artigos`/`clusters` do Supabase; pillars com `priority` maior. |
| Leituras Supabase de produtos/categorias/marcas com `slug`+`nome` | `lib/data.ts` | Fonte das **entidades-destino** do dicionário (produto/categoria/marca). |
| `produtos.busca_tsv` `tsvector('portuguese')` com `immutable_unaccent` + GIN; `pg_trgm`; `unaccent` | `0001_init.sql` | **Reforço/fallback** do matching: `websearch_to_tsquery` contra `busca_tsv`. A normalização pt-BR do JS espelha `immutable_unaccent`. |
| Função `recomendar_para_carrinho(uuid[], int)` — **cascata de score determinística em SQL** (complementares +10 → categoria +3 → marca +1), `security invoker`, `grant ... to anon` | `0012_recomendacoes.sql` | **Precedente direto** do nosso algoritmo. Reusamos o mesmo padrão (RPC SQL com score ponderado) para "produtos relacionados a um artigo". |
| `produto_enriquecimento`: fila de candidatos com `score`, `status pendente\|aprovado\|rejeitado`, revisão no admin | `0010_enriquecimento.sql` | **Precedente de UX/admin**: o motor segue o mesmo padrão de "pré-computar candidatos com score + revisão opcional no admin". |
| Convenções de schema: nomes pt, `slug unique`, RLS, `is_admin()`, grants explícitos (`0016`), trigger `updated_at`/`atualizado_em` | `0001`,`0002`,`0016` | Toda migration nova segue estas convenções (ver §6). |
| Padrão de CRUD admin: server actions `"use server"`, `createSupabaseServerClient()`, `slugify()` local, `useActionState`, `revalidatePath` | `app/admin/produtos/{actions.ts,ProdutoForm.tsx}`, `app/admin/marcas/actions.ts` | O save do artigo (que dispara o motor) segue exatamente esse padrão. |
| Busca atual: `ILIKE` em `nome` (autocomplete) — comentário já prevê migração para `websearch_to_tsquery` | `api/routers/busca.py` | Confirma que tsvector é o caminho "oficial" de busca; o motor o usa server-side via RPC. |

**Decisão derivada:** já existe um precedente forte de "score determinístico em SQL com grants" (`recomendar_para_carrinho`). O motor de linkagem **não reinventa** — segue o mesmo idioma.

---

## 2. Arquitetura em uma frase

> **No save do artigo no admin**, um passo determinístico (`buildInternalLinks`) lê o corpo do artigo, constrói um **dicionário termo→entidade** (a partir de nomes/slugs de produtos/categorias/marcas + keywords de outros artigos), encontra ocorrências com normalização pt-BR, aplica regras anti-spam, e **grava o resultado materializado** (links in-content + blocos de relacionados) em colunas/tabelas do Supabase. **No render (RSC)**, a página apenas lê esse resultado e o desenha — zero processamento pesado, zero custo.

```
                    ADMIN (save)                              PÚBLICO (render, RSC)
  ┌────────────────────────────────────────┐        ┌──────────────────────────────────┐
  │ salvarArtigoAction (server action)      │        │ /artigos/[slug] (page.tsx)        │
  │   1. valida + slugify + upsert artigo   │        │   1. getArtigo(slug)  ← Supabase  │
  │   2. carrega dicionário (cacheado)      │        │   2. lê links_inline (JSONB)      │
  │   3. buildInternalLinks(corpo, dict)    │        │   3. lê relacionados materializados│
  │   4. grava:                             │        │   4. renderiza:                   │
  │        artigos.links_inline (JSONB)     │  ───►  │      - corpo c/ <Link> in-content │
  │        artigos.relacionados_* (JSONB)   │        │      - <RelatedProducts/>         │
  │        artigo_links (tabela, p/ grafo)  │        │      - <LeiaTambem/> (cluster)    │
  │   5. revalidateTag('artigos')           │        │      - <CategoriasRelacionadas/>  │
  └────────────────────────────────────────┘        │      - JSON-LD enriquecido         │
                                                     └──────────────────────────────────┘
```

**Por que pré-computar no save e não no render?** (decisão explícita, §5)
- O dicionário tem ~1.600 SKUs + categorias + marcas + N artigos. Construí-lo e varrer o corpo em **cada** request RSC seria caro e não-determinístico sob ISR.
- O conteúdo muda raramente (save no admin); o tráfego (53k/mês projetado) é alto. Computar no evento raro, ler no evento frequente.
- Resultado materializado = render trivial, cacheável, e **auditável**: o admin vê exatamente quais links foram inseridos e pode trancá-los (lock manual).

---

## 3. Algoritmo determinístico de matching

### 3.1 Normalização pt-BR (espelha `immutable_unaccent` do Postgres)

Função pura, sem dependências. **Deve produzir a mesma forma canônica** que o `unaccent` do banco para que JS e SQL concordem.

```ts
// lib/seo/normalize.ts
/** Forma canônica para matching: minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function normalizePt(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos (= unaccent)
    .replace(/[^a-z0-9\s-]/g, " ")   // pontuação → espaço
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza em palavras (para limites de palavra). */
export function tokensPt(s: string): string[] {
  return normalizePt(s).split(" ").filter(Boolean);
}
```

> **Nota de fidelidade:** o `to_tsvector('portuguese')` também faz *stemming* (furadeira/furadeiras). O matching JS por dicionário **não** faz stemming nativo — por isso registramos no dicionário tanto singular quanto plural via sinônimos (§3.2) e deixamos o **tsvector como reforço** (§3.5) para capturar variações morfológicas que o dicionário não cobriu.

### 3.2 O dicionário termo→entidade

Cada entidade linkável vira uma ou mais **entradas** (termo normalizado → destino). Construído a partir do que já existe no banco:

```ts
// lib/seo/internal-links.ts
export type LinkTargetType = "produto" | "categoria" | "marca" | "artigo" | "cluster";

export interface LinkTarget {
  type: LinkTargetType;
  id: string;            // uuid (Supabase) ou slug (modo transição)
  slug: string;
  nome: string;          // nome canônico (para âncora "exata")
  href: string;          // /catalogo?categoria=... | /marca/[slug] | /produto/[slug] | /artigos/[slug] | /guias/[slug]
  prioridade: number;    // peso base por tipo — ver §3.4
}

export interface DictEntry {
  termo: string;         // termo JÁ normalizado (normalizePt)
  ngram: number;         // nº de palavras (para casar n-gramas maiores primeiro)
  target: LinkTarget;
  fonte: "nome" | "slug" | "keyword" | "sinonimo";
}
```

**De onde saem os termos:**

| Entidade | Termos gerados (normalizados) | href |
|---|---|---|
| **Produto** (`lib/data.ts: produtos`) | `nome` ("Furadeira de Impacto Bosch GSB 13 RE"), modelo/código quando distintivo ("GSB 13 RE", "DWE560") | `/produto/{slug}` |
| **Categoria** (`categorias`) | `nome` ("Furadeiras", "Serras", "EPI"...), singular/plural | `/catalogo?categoria={slug}` |
| **Marca** (`marcas`) | `nome` ("Bosch", "Makita", "DeWalt") | `/marca/{slug}` |
| **Artigo** (`artigos`) `[dep: Parte 1]` | `keywords[]` do próprio artigo + título curto | `/artigos/{slug}` |
| **Cluster/Pillar** (`clusters`) `[dep: Parte 1]` | nome do cluster + keyword-pilar | `/guias/{slug}` |
| **Sinônimos** (tabela `seo_sinonimos`, §6) | curados pelo admin: "parafusadeira sem fio"→categoria, "alicate isolado nr10"→produto/categoria, "epi"→categoria EPI | conforme alvo |

**Construção (cacheada em memória do processo, invalidada por `revalidateTag`):**

```ts
export async function buildDictionary(): Promise<DictEntry[]> {
  const [produtos, categorias, marcas, artigos, clusters, sinonimos] =
    await Promise.all([
      loadProdutosLink(),    // id, slug, nome, codigo  (lib/data.ts)
      loadCategoriasLink(),  // id, slug, nome
      loadMarcasLink(),      // id, slug, nome
      loadArtigosLink(),     // id, slug, titulo, keywords[]   [dep: Parte 1]
      loadClustersLink(),    // id, slug, nome, keyword_pilar  [dep: Parte 1]
      loadSinonimos(),       // termo, target_type, target_id
    ]);

  const entries: DictEntry[] = [];
  const push = (termo: string, target: LinkTarget, fonte: DictEntry["fonte"]) => {
    const n = normalizePt(termo);
    if (n.length < MIN_TERMO_LEN) return;        // descarta termos curtos demais (ruído)
    if (STOPTERMS.has(n)) return;                // descarta termos genéricos ("kit", "ferramenta")
    entries.push({ termo: n, ngram: n.split(" ").length, target, fonte });
  };
  // ... push para cada entidade ...

  // Ordena por: ngram desc (casa expressões longas antes), depois prioridade desc.
  // Isso garante que "furadeira de impacto" case antes de "furadeira".
  return entries.sort((a, b) => b.ngram - a.ngram || b.target.prioridade - a.target.prioridade);
}
```

### 3.3 Varredura do corpo e inserção (pseudo-código)

O corpo é `ArticleBlock[]`. Linkamos **apenas em `paragraph` e nos `items` de `list`** (nunca em `heading` — headings não recebem links, boa prática). Para cada bloco de texto, varremos com **busca de n-gramas guiada por limites de palavra**, respeitando o markup (operamos sobre o texto plano e devolvemos *spans* posicionais, sem nunca cortar no meio de uma palavra).

```ts
export interface InlineLink {
  blockIndex: number;        // qual bloco do content[]
  itemIndex?: number;        // se for list, qual item
  start: number;             // offset no texto plano do bloco/item
  end: number;
  anchor: string;            // texto-âncora EXATO como aparece no corpo (preserva caixa/acento)
  target: LinkTarget;
}

export interface BuildResult {
  inline: InlineLink[];      // links dentro do corpo
  relatedProdutos: LinkTarget[];
  relatedCategorias: LinkTarget[];
  relatedMarcas: LinkTarget[];
  leiaTambem: LinkTarget[];  // artigos (mesmo cluster primeiro) + pillar
  pillar?: LinkTarget;       // o pillar deste cluster (link "sobe")
}

function buildInternalLinks(article: ArticleInput, dict: DictEntry[]): BuildResult {
  const usedTargets = new Set<string>();   // 1 link por destino (dedup global)
  const usedTermos = new Set<string>();    // 1 link por termo
  const inline: InlineLink[] = [];
  const selfHref = `/artigos/${article.slug}`;

  for (let b = 0; b < article.content.length; b++) {
    const block = article.content[b];
    if (block.type === "heading") continue;            // headings nunca recebem link
    const texts = block.type === "list" ? block.items : [block.text];

    for (let it = 0; it < texts.length; it++) {
      const raw = texts[it];
      const normMap = buildNormIndexMap(raw); // mapeia offset normalizado ↔ offset raw

      // Varre da esquerda p/ direita; ao casar, "consome" o trecho (sem sobreposição).
      let cursor = 0;
      while (cursor < normMap.norm.length && inline.length < MAX_LINKS_TOTAL) {
        const match = matchAt(normMap.norm, cursor, dict, {
          atWordBoundary: true,           // só casa em limite de palavra
        });
        if (!match) { cursor = nextWord(normMap.norm, cursor); continue; }

        const { entry, normStart, normEnd } = match;
        const t = entry.target;

        // ---------- REGRAS ANTI-SPAM (§4) ----------
        const skip =
          t.href === selfHref ||                       // nunca linkar a própria página
          usedTargets.has(t.href) ||                   // 1 link por destino
          usedTermos.has(entry.termo) ||               // 1 link por termo
          inProximityWindow(inline, b, it, normStart); // anti-cluster: nada de 2 links colados

        if (skip) { cursor = normEnd; continue; }
        if (isInsideExistingLink(inline, b, it, normStart, normEnd)) { cursor = normEnd; continue; }

        const { start, end } = normMap.toRaw(normStart, normEnd);
        inline.push({
          blockIndex: b, itemIndex: block.type === "list" ? it : undefined,
          start, end, anchor: raw.slice(start, end), target: t,
        });
        usedTargets.add(t.href);
        usedTermos.add(entry.termo);
        cursor = normEnd;
      }
    }
  }

  // ---------- BLOCOS RELACIONADOS (não dependem do corpo conter o termo) ----------
  const related = scoreRelated(article, dict);  // ver §3.4 / §3.5 (tsvector reforço)
  return {
    inline,
    relatedProdutos: related.produtos.slice(0, MAX_PRODUTOS_BLOCO),    // 3–4
    relatedCategorias: related.categorias.slice(0, MAX_CATEGORIAS),     // 2–3
    relatedMarcas: related.marcas.slice(0, MAX_MARCAS),                 // 1–2
    leiaTambem: related.artigos.slice(0, MAX_LEIA_TAMBEM),             // 3
    pillar: related.pillar,
  };
}
```

### 3.4 Prioridade e desempate (determinístico, sem aleatoriedade)

Quando dois destinos casam o mesmo trecho, ganha por ordem fixa (sem `Math.random` — o resultado precisa ser reprodutível byte-a-byte):

1. **n-grama maior** ("furadeira de impacto" > "furadeira"). Evita linkar genérico quando há específico.
2. **prioridade por tipo** (peso base):
   - `produto` específico mencionado por nome = **5** (mais valioso comercialmente — leva ao orçamento)
   - `cluster/pillar` = **4** (estrutura de autoridade)
   - `categoria` = **3**
   - `artigo` = **2**
   - `marca` = **1** (genérico; muitas páginas competem)
3. **match exato de nome** > match por keyword/sinônimo (`fonte`).
4. **slug alfabético** (tie-break final estável).

> Ambiguidade real do catálogo Natalmaq: "Bosch" pode ser marca **e** aparecer no nome de vários produtos. Regra: dentro do corpo, **a marca só é linkada se não houver produto/categoria específico no mesmo parágrafo competindo** — e como produto/categoria têm prioridade maior e n-grama maior, a marca naturalmente perde o slot. "Bosch vs DeWalt" (keyword de cluster 5) é resolvido pelo **cluster** (prioridade 4 > marca 1), levando ao guia comparativo e não a duas páginas de marca soltas.

### 3.5 tsvector como reforço (server-side, para os *blocos* relacionados)

O matching por dicionário resolve os **links in-content** (precisa do termo literal no texto). Já os **blocos "Produtos relacionados"** não exigem o termo no corpo — usam relevância semântica/full-text. Aqui entra o tsvector, via RPC SQL no padrão de `recomendar_para_carrinho`:

```sql
-- 0019_seo_linkagem.sql  (trecho — função de reforço)
-- Dado o texto agregado do artigo (corpo + keywords), retorna os produtos
-- mais relevantes por full-text (busca_tsv) com score por rank.
create or replace function public.produtos_relevantes_para_texto(
  texto text,
  limite int default 6
)
returns table (
  id uuid, slug text, nome text, preco numeric, preco_promocional numeric,
  imagens jsonb, marca jsonb, score real
)
language sql stable security invoker set search_path = public as $$
  with q as (
    select websearch_to_tsquery('portuguese', public.immutable_unaccent(texto)) as tsq
  )
  select p.id, p.slug, p.nome, p.preco, p.preco_promocional, p.imagens,
         case when m.id is null then null
              else jsonb_build_object('id', m.id, 'nome', m.nome, 'slug', m.slug) end,
         ts_rank(p.busca_tsv, q.tsq) as score
  from produtos p, q
  left join marcas m on m.id = p.marca_id
  where p.ativo and p.produto_pai_id is null and p.estoque > 0
    and p.busca_tsv @@ q.tsq
  order by score desc, (p.preco_promocional is not null) desc, p.nome
  limit greatest(1, least(coalesce(limite, 6), 12));
$$;
grant execute on function public.produtos_relevantes_para_texto(text, int) to anon, authenticated, service_role;
```

**Estratégia combinada no `scoreRelated`:**
1. **Sinal forte (dicionário):** produtos/categorias/marcas **explicitamente citados** no corpo → entram primeiro, score alto.
2. **Sinal de reforço (tsvector):** chama `produtos_relevantes_para_texto(corpo+keywords)` para completar a lista quando faltam citações diretas (artigo "normas NR" cita poucos produtos por nome, mas o tsvector encontra EPIs relevantes).
3. **Categorias relacionadas:** derivadas das categorias dos produtos selecionados (frequência) + categorias citadas.
4. **`leiaTambem` (artigos):** **mesmo cluster primeiro** (ordenado por proximidade de keywords), depois artigos de clusters irmãos; sempre inclui o **pillar** do cluster (link "sobe").

---

## 4. Regras anti-spam / over-optimization

Baseadas nas recomendações de Ahrefs e Backlinko (ver §10). Todas configuráveis em `lib/seo/config.ts` para ajuste sem mexer no algoritmo.

| Regra | Valor padrão | Racional |
|---|---|---|
| **Máx. links in-content por artigo** | `MAX_LINKS_TOTAL = 8` (≈3–5 por 1.500 palavras, escala com o tamanho) | Ahrefs: 3–5 contextuais é um bom ponto de partida; evita "link stuffing". |
| **Densidade** | máx **1 link a cada ~120 palavras** | Evita parágrafos cobertos de links. |
| **1 link por destino (href)** | `usedTargets` global | Não repetir o mesmo destino — dilui sinal e parece spam. |
| **1 link por termo** | `usedTermos` global | Não linkar "furadeira" três vezes. |
| **Nunca auto-linkar** | `t.href === selfHref` | Página não linka para si mesma. |
| **Sem links em headings** | `block.type === "heading" → skip` | Headings são estrutura, não âncora. |
| **Janela de proximidade** | sem 2 links nas mesmas ~10 palavras | Anti-cluster visual; legibilidade. |
| **Âncoras variadas** | usa o **texto real do corpo** como âncora (não força a keyword exata sempre); admin pode editar | Backlinko/Ahrefs: variar âncora; evitar over-otimização de exact-match; nunca "clique aqui". |
| **Não quebrar markup** | opera sobre texto plano + offsets; nunca casa dentro de outro link; nunca corta palavra | Render seguro; sem HTML inválido. |
| **Blocos: produtos** | 3–4 | Manter blocos enxutos e relevantes. |
| **Blocos: categorias** | 2–3 | — |
| **Blocos: marcas** | 1–2 | — |
| **Leia também** | 3 (cluster + pillar) | Densidade saudável de links contextuais entre artigos. |
| **Lock manual** | flag `links_locked` por artigo | Se o admin editou os links à mão, o motor **não** sobrescreve no próximo save. |

```ts
// lib/seo/config.ts
export const LINK_RULES = {
  MAX_LINKS_TOTAL: 8,
  PALAVRAS_POR_LINK: 120,
  PROXIMIDADE_PALAVRAS: 10,
  MIN_TERMO_LEN: 4,
  MAX_PRODUTOS_BLOCO: 4,
  MAX_CATEGORIAS: 3,
  MAX_MARCAS: 2,
  MAX_LEIA_TAMBEM: 3,
} as const;

// Termos genéricos demais para virar âncora sozinhos (reduz ruído/ambiguidade).
export const STOPTERMS = new Set([
  "kit", "ferramenta", "ferramentas", "equipamento", "equipamentos",
  "produto", "produtos", "obra", "qualidade", "marca", "profissional",
]);
```

> `MAX_LINKS_TOTAL` é um **teto**; o motor escala pelo tamanho do texto: `min(MAX_LINKS_TOTAL, floor(palavras / PALAVRAS_POR_LINK))`. Um artigo de 1.500 palavras → ~8 links no máximo, alinhado à recomendação de 3–5+ contextuais para conteúdo longo.

---

## 5. Onde roda + data model do resultado

### 5.1 Decisão: **pré-computar no save** (recomendado)

| Critério | Pré-computar no save (escolhido) | Computar no render (RSC) |
|---|---|---|
| Custo runtime | ~zero (só lê JSONB) | constrói dicionário + varre a cada miss de cache |
| Determinismo sob ISR | total (materializado) | depende de ordem de leitura/cache |
| Auditável pelo admin | sim (vê e tranca os links) | não |
| Frequência | roda no evento raro (save) | roda no evento frequente (request) |
| Complexidade | server action + migration | menos arquivos, mas pior em escala |

**Recomendação:** pré-computar no **save do artigo no admin** e materializar. Render lê pronto. (Mesma filosofia de `produto_enriquecimento`: computa candidatos com score, materializa, e o admin revisa.)

### 5.2 Data model (migration `0019_seo_linkagem.sql`)

Segue convenções: nomes pt, RLS, `is_admin()`, grants explícitos, trigger `atualizado_em`. **Assume tabela `artigos` da Parte 1**; se ainda não existir, ver §9 (modo transição grava num `artigos_seo` standalone chaveado por slug).

```sql
-- Resultado materializado vive em colunas na própria tabela artigos:
alter table artigos
  add column if not exists links_inline   jsonb not null default '[]'::jsonb,  -- InlineLink[]
  add column if not exists relacionados   jsonb not null default '{}'::jsonb,  -- { produtos, categorias, marcas, leiaTambem, pillar }
  add column if not exists links_locked   boolean not null default false,      -- admin trancou edição manual
  add column if not exists links_geradoem timestamptz;

-- Grafo de links (1 linha por aresta artigo→entidade) — para sitemap, métricas,
-- auditoria de "páginas órfãs" e links bidirecionais pillar↔satélite.
create table if not exists artigo_links (
  id           uuid primary key default gen_random_uuid(),
  artigo_id    uuid not null references artigos(id) on delete cascade,
  target_type  text not null check (target_type in ('produto','categoria','marca','artigo','cluster')),
  target_id    uuid,                 -- null p/ destinos não-uuid (categoria via slug em querystring)
  target_slug  text not null,
  target_href  text not null,
  contexto     text not null check (contexto in ('inline','produtos','categorias','marcas','leia_tambem','pillar')),
  anchor       text,                 -- âncora usada (só p/ inline)
  posicao      int not null default 0,
  criado_em    timestamptz not null default now()
);
create index if not exists idx_artigo_links_artigo on artigo_links(artigo_id);
create index if not exists idx_artigo_links_target on artigo_links(target_type, target_id);

-- Sinônimos curados pelo admin (termo → entidade). Reforça/ajusta o dicionário.
create table if not exists seo_sinonimos (
  id           uuid primary key default gen_random_uuid(),
  termo        text not null,        -- ex: "parafusadeira sem fio", "alicate isolado nr10"
  target_type  text not null check (target_type in ('produto','categoria','marca','artigo','cluster')),
  target_id    uuid,
  target_slug  text,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);
create unique index if not exists idx_seo_sinonimos_termo on seo_sinonimos(lower(termo));

-- RLS
alter table artigo_links  enable row level security;
alter table seo_sinonimos enable row level security;
-- Leitura pública (render usa via colunas em artigos; grafo é público p/ sitemap/RPC)
create policy "artigo_links read"  on artigo_links  for select using (true);
create policy "seo_sinonimos read" on seo_sinonimos for select using (ativo);
-- Escrita só admin
create policy "admin all artigo_links"  on artigo_links  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all seo_sinonimos" on seo_sinonimos for all using (public.is_admin()) with check (public.is_admin());

-- Grants explícitos (padrão 0016) já cobertos pelo "grant all on all tables ...";
-- defaults para tabelas futuras também já configurados naquele migration.
```

**Por que JSONB nas colunas + tabela-grafo redundante?**
- `links_inline`/`relacionados` (JSONB) = **fonte de verdade do render** (1 leitura, render trivial).
- `artigo_links` (linhas) = **fonte de verdade analítica**: permite `JOIN`/agregação para detectar páginas órfãs, contar inlinks por produto (priorização SEO), montar links **bidirecionais** (qual satélite aponta pro pillar e vice-versa) e alimentar o sitemap. Gravados na mesma transação do save.

---

## 6. Renderização (componentes RSC, design "Indústria")

Todos os componentes são **Server Components** (sem `"use client"`), recebem dados já materializados e usam as classes Tailwind existentes (`bg-bone`, `text-ink`, `text-ink-2`, `brand-500`, `border-line`, `font-display`, `font-mono`, `tracking-mono`).

### 6.1 Links in-content — `components/seo/LinkedText.tsx`

Recebe o texto plano de um bloco/item + os `InlineLink[]` daquele bloco e devolve React com `<Link>` nos spans. **Não usa `dangerouslySetInnerHTML`** — monta nós React a partir dos offsets (markup sempre válido).

```tsx
// components/seo/LinkedText.tsx  (RSC)
import Link from "next/link";
import type { InlineLink } from "@/lib/seo/internal-links";

export function LinkedText({ text, links }: { text: string; links: InlineLink[] }) {
  if (links.length === 0) return <>{text}</>;
  const sorted = [...links].sort((a, b) => a.start - b.start);
  const out: React.ReactNode[] = [];
  let cursor = 0;
  for (const l of sorted) {
    if (l.start > cursor) out.push(text.slice(cursor, l.start));
    out.push(
      <Link
        key={`${l.start}-${l.end}`}
        href={l.target.href}
        className="font-medium text-brand-600 underline decoration-brand-500/30 underline-offset-2 transition hover:decoration-brand-500"
      >
        {l.anchor}
      </Link>,
    );
    cursor = l.end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}
```

O render do artigo (`app/(public)/artigos/[slug]/page.tsx`) troca os `{block.text}` / `{item}` crus por `<LinkedText text={...} links={linksFor(b, it)} />`, mantendo todo o resto do markup atual (mesmas classes de `<p>`, `<ul>`, `<h2>`).

### 6.2 Blocos de relacionados

- `components/seo/RelatedProducts.tsx` — "Produtos relacionados" (3–4 cards). Reaproveita o card de produto do catálogo (`components/catalog/*`) para consistência visual; cada card leva a `/produto/{slug}` (que tem o botão de adicionar à cesta → orçamento WhatsApp). **Forte vínculo conteúdo→conversão.**
- `components/seo/LeiaTambem.tsx` — "Leia também" (3 artigos: mesmo cluster + pillar). Reaproveita o card de artigo do índice (`app/(public)/artigos/page.tsx`).
- `components/seo/CategoriasRelacionadas.tsx` — chips/pills de categoria (`/catalogo?categoria=...`) e marca (`/marca/...`), estilo `font-mono uppercase tracking-mono`, borda `brand-500/50` (idêntico ao badge de categoria já usado no artigo).
- `components/seo/RelatedSection.tsx` — wrapper que orquestra os três acima na ordem: Produtos → Categorias/Marcas → Leia também, cada um com cabeçalho `font-mono` "PRODUTOS RELACIONADOS" etc., só renderizando se houver itens.

Layout: inseridos **após o corpo do artigo, antes do "Voltar para os artigos"**, dentro do mesmo container `max-w-3xl` (in-content blocks podem ir full-width `max-w-[1280px]` se preferir grade de cards — decisão de UI fina deixada para a Parte de UI).

### 6.3 Relação pillar ↔ satélite (bidirecional)

`[dep: Parte 1]` define `clusters` (pillar) e `artigos.cluster_id`. O motor garante a malha nos dois sentidos:

- **Satélite → pillar:** `buildInternalLinks` sempre adiciona o pillar do cluster em `relacionados.pillar` (e tenta um link in-content quando a keyword-pilar aparece). Renderizado como destaque no topo de "Leia também": *"Guia completo: {nome do pillar}"*.
- **Pillar → satélites:** a página do pillar (`/guias/[slug]`) lista **todos** os artigos do seu cluster (consulta `artigos where cluster_id = pillar.cluster_id`), via `components/seo/ClusterIndex.tsx` (`ItemList` JSON-LD `[dep: Parte 2]`). Assim cada satélite recebe pelo menos 1 inlink do pillar e devolve 1 ao pillar — *hub-and-spoke* clássico.
- O grafo `artigo_links` permite auditar lacunas: `contexto='pillar'` ausente num satélite = alerta no admin.

---

## 7. Integração no save (admin) e no render

### 7.1 Server action de save (segue padrão de `app/admin/produtos/actions.ts`)

```ts
// app/admin/artigos/actions.ts  (trecho)  [dep: Parte 1 — tela de artigos]
"use server";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDictionary, buildInternalLinks } from "@/lib/seo/internal-links";
import { persistLinks } from "@/lib/seo/persist";

export async function salvarArtigoAction(_prev: unknown, formData: FormData) {
  const sb = await createSupabaseServerClient();
  const artigo = parseArtigoForm(formData);          // valida + slugify (padrão existente)
  const { data: saved, error } = await sb.from("artigos")
    .upsert(artigo, { onConflict: "slug" }).select("*").single();
  if (error) return { error: error.message };

  if (!saved.links_locked) {                          // respeita lock manual
    const dict = await buildDictionary();             // cacheado (revalidateTag)
    const result = buildInternalLinks(saved, dict);
    await persistLinks(sb, saved.id, result);         // grava JSONB + artigo_links (transação)
  }

  revalidateTag("artigos");                           // invalida render público + sitemap + dict
  return { ok: true };
}
```

`persistLinks` grava `links_inline`, `relacionados`, `links_geradoem`, e substitui as linhas de `artigo_links` daquele artigo (delete+insert no mesmo round-trip). Também há um **botão "Recalcular links de todos os artigos"** (rebuild em lote — útil quando o catálogo muda muito), seguindo o padrão de jobs do admin.

### 7.2 Cache

- `buildDictionary()` usa `unstable_cache`/`cache` com tag `artigos` + `catalogo` → reconstruído quando produto/categoria/marca/artigo muda (os saves desses já chamam `revalidatePath`/`revalidateTag`).
- Render público: `getArtigo(slug)` cacheado com tag `artigos`; ISR razoável (ex.: `revalidate = 3600`, igual ao sitemap atual), invalidado no save.

### 7.3 Sitemap

`app/sitemap.ts` passa a ler `artigos` + `clusters` do Supabase (em vez de `lib/articles.ts`), pillars com `priority` 0.7–0.8 e satélites 0.6 — e pode usar `artigo_links` para não emitir páginas órfãs. Mantém o `try/catch` best-effort existente.

---

## 8. Interfaces TS e arquivos a criar

### 8.1 Tipos centrais (`lib/seo/types.ts`)

```ts
export type LinkTargetType = "produto" | "categoria" | "marca" | "artigo" | "cluster";
export interface LinkTarget { type: LinkTargetType; id: string; slug: string; nome: string; href: string; prioridade: number; }
export interface DictEntry { termo: string; ngram: number; target: LinkTarget; fonte: "nome"|"slug"|"keyword"|"sinonimo"; }
export interface InlineLink { blockIndex: number; itemIndex?: number; start: number; end: number; anchor: string; target: LinkTarget; }
export interface RelatedBundle { produtos: LinkTarget[]; categorias: LinkTarget[]; marcas: LinkTarget[]; leiaTambem: LinkTarget[]; pillar?: LinkTarget; }
export interface BuildResult { inline: InlineLink[]; related: RelatedBundle; }
export interface ArticleInput { id: string; slug: string; titulo: string; keywords: string[]; cluster_id?: string; content: ArticleBlock[]; }
```

### 8.2 Arquivos

| Arquivo | Papel |
|---|---|
| `lib/seo/types.ts` | tipos acima |
| `lib/seo/config.ts` | `LINK_RULES`, `STOPTERMS`, pesos de prioridade |
| `lib/seo/normalize.ts` | `normalizePt`, `tokensPt`, `buildNormIndexMap` (offset norm↔raw) |
| `lib/seo/dictionary.ts` | `buildDictionary` + loaders (`loadProdutosLink` etc., reusam `lib/data.ts`) |
| `lib/seo/internal-links.ts` | `buildInternalLinks` (varredura + anti-spam), `matchAt`, `scoreRelated` |
| `lib/seo/persist.ts` | `persistLinks` (grava JSONB + `artigo_links`) |
| `components/seo/LinkedText.tsx` | links in-content (RSC) |
| `components/seo/RelatedProducts.tsx` | bloco "Produtos relacionados" (RSC) |
| `components/seo/LeiaTambem.tsx` | bloco "Leia também" (cluster + pillar) (RSC) |
| `components/seo/CategoriasRelacionadas.tsx` | chips categorias/marcas (RSC) |
| `components/seo/RelatedSection.tsx` | wrapper que orquestra os blocos (RSC) |
| `components/seo/ClusterIndex.tsx` | índice de satélites na página do pillar (RSC) |
| `supabase/migrations/0019_seo_linkagem.sql` | colunas em `artigos` + `artigo_links` + `seo_sinonimos` + RPC `produtos_relevantes_para_texto` + RLS/grants |
| `app/admin/artigos/actions.ts` | `salvarArtigoAction` dispara o motor (já em `[dep: Parte 1]`, mas o gatilho do motor é aqui) |
| `app/admin/seo/sinonimos/` | CRUD de `seo_sinonimos` (padrão `MarcasManager`) |

Arquivos **modificados**: `app/(public)/artigos/[slug]/page.tsx` (usa `LinkedText` + `RelatedSection`), `app/(public)/artigos/page.tsx` (agrupar por cluster), `app/sitemap.ts` (ler artigos/clusters do Supabase).

---

## 9. Modo de transição (sem depender da Parte 1)

Se a tabela `artigos` ainda não existir quando esta parte for implementada:

- Os loaders de **produtos/categorias/marcas** já funcionam hoje (`lib/data.ts`).
- O motor roda contra os **3 artigos de `lib/articles.ts`** num script de build/seed que grava o resultado em uma tabela mínima `artigos_seo(slug pk, links_inline jsonb, relacionados jsonb)` — render lê de lá por slug.
- "Leia também"/cluster/pillar ficam limitados a artigo↔artigo simples (sem hub) até a Parte 1 entrar; produtos/categorias/marcas funcionam 100%.
- Quando a Parte 1 migrar os artigos para o Supabase, troca-se a fonte e ativa-se a malha pillar↔cluster — sem mudar o algoritmo.

---

## 10. Boas práticas citadas (limites confirmados)

- **3–5 links contextuais por artigo** como ponto de partida (escala com tamanho do conteúdo). — [Ahrefs: Internal Links for SEO](https://ahrefs.com/blog/internal-links-for-seo/)
- **Âncoras descritivas e variadas**, nunca "clique aqui"; evitar over-otimização de exact-match. — [Backlinko: Internal Linking for SEO](https://backlinko.com/hub/seo/internal-links)
- **Não exagerar na quantidade** para não acionar filtros de spam; revisar distribuição de âncoras. — [Ahrefs](https://ahrefs.com/blog/internal-links-for-seo/) · [Stan Ventures 2026](https://www.stanventures.com/blog/internal-links/)
- **Hub-and-spoke (pillar↔cluster)** e priorizar links internos como tática de ranqueamento. — [Ahrefs: Prioritize Internal Linking](https://ahrefs.com/blog/prioritize-internal-linking/)

Estes limites estão codificados em `LINK_RULES` (§4) e podem ser ajustados sem tocar no algoritmo.

---

## 11. Resumo do fluxo (TL;DR)

1. **Admin salva artigo** → `salvarArtigoAction`.
2. Motor **constrói dicionário** (produtos/categorias/marcas/artigos/clusters/sinônimos, normalizado pt-BR, ordenado por n-grama+prioridade).
3. **Varre o corpo** (só parágrafos/listas), casa n-gramas em limite de palavra, aplica **anti-spam** (≤8 links, 1/destino, 1/termo, sem auto-link, sem heading, âncoras reais).
4. **tsvector reforça** os blocos "relacionados" (RPC `produtos_relevantes_para_texto`).
5. **Materializa** em `artigos.links_inline`/`relacionados` (render) + `artigo_links` (grafo/auditoria/sitemap).
6. **Render RSC** lê pronto e desenha: links in-content + Produtos relacionados + Categorias/Marcas + Leia também + pillar — tudo no design "Indústria".
7. **Pillar↔satélite bidirecional**; grafo detecta páginas órfãs.
8. **Custo runtime: zero.** Tudo determinístico, reproduzível, editável pelo admin (com lock), publica sem deploy.
