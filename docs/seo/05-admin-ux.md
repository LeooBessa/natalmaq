# 05 — UX do Admin de Conteúdo/SEO (Natalmaq)

> Documento de design de produto/front-end. Define **o que** o dono vê e usa para
> gerir todo o conteúdo/SEO sem dev e **custo zero** em runtime. A modelagem de
> banco (tabelas), as regras determinísticas de SEO score e o algoritmo de
> linkagem interna ficam nos docs `01`–`04`; aqui referenciamos esses contratos
> e focamos em telas, rotas, componentes e server actions.

## 0. Princípios e premissas (lidos do código)

O admin atual **já tem um padrão estabelecido** que vamos reaproveitar 1:1.
Importante: o admin usa um design **diferente** do site público.

| Camada | Site público (`app/(public)`) | Admin (`app/admin`) |
|---|---|---|
| Fundo | `bg-bone` / `bg-navy` | `bg-zinc-50` / `bg-white` |
| Texto | `text-ink` / `text-ink-2` | `text-zinc-900` / `text-zinc-500` |
| Acento | `brand-500` (#FF6B00) | `brand-600` (#DB5B00) |
| Tipografia | `font-display` (Archivo Black) + `font-mono` | sans default (Inter) |
| Bordas | `border-line` (#D6D2C9) | `border-zinc-200` |

**Regra de ouro:** as telas do admin seguem o look "limpo" do admin
(`bg-white` + `border-zinc-200` + `brand-600`), NÃO o look "Indústria" público.
Só os **previews** (snippet do Google, card OG, preview de artigo) imitam o
visual público para fidelidade.

### Padrões de código a reaproveitar (já existem)

- **Auth/guard:** `app/admin/layout.tsx` checa `sb.auth.getUser()` e renderiza a
  sidebar `AdminNav`. Toda rota nova sob `/admin` herda isso de graça. RLS via
  `public.is_admin()` (migration `0002_admin.sql`).
- **Navegação:** `components/admin/AdminNav.tsx` — array `NAV_GROUPS` por grupos.
  Adicionamos um grupo novo "Conteúdo / SEO".
- **Listagem:** `app/admin/produtos/page.tsx` — RSC, `searchParams` para
  busca/paginação, `<table>` com `bg-zinc-50` no head, badges de status
  (`rounded-full bg-green-100 ...`), `export const dynamic = "force-dynamic"`.
- **Form full-page:** `app/admin/produtos/ProdutoForm.tsx` — `"use client"`,
  `useActionState`, helper `<Field>`, constante `input` (classe compartilhada),
  upload via `uploadParaBucket`, estado de imagens local + hidden input, toasts
  inline (`bg-red-50` / `bg-green-50`), botão "Apagar" com `confirm()`.
- **Form master-detail (lista + form lateral):** `app/admin/marcas/MarcasManager.tsx`
  — grid `lg:grid-cols-[1fr_400px]`, edição inline, `useTransition`.
- **Drag-and-drop:** `app/admin/pedidos/kanban/KanbanBoard.tsx` usa `@dnd-kit/core`
  (`DndContext`, `PointerSensor`, `DragOverlay`). Para reordenar **blocos do
  artigo** usaremos `@dnd-kit/sortable` (`SortableContext`, `useSortable`,
  `arrayMove`) — já está no `package.json`.
- **Fila revisar/aprovar-rejeitar:** `app/admin/enriquecimento/RevisaoList.tsx`
  — cartões com badge de score colorido (`scoreCor()`), botões Aprovar/Rejeitar,
  `Set` de resolvidos. **Este é o molde direto da tela de "aceitar/rejeitar
  links internos sugeridos".**
- **Server actions:** padrão `app/admin/*/actions.ts` — `"use server"`,
  `slugify()` local, `revalidatePath()`, retorno `{ ok?: boolean; error?: string }`.
- **Upload:** `app/admin/_lib/upload.ts` (`uploadParaBucket("produtos"|"marketing", fd)`).
  Acrescentamos o bucket `"conteudo"` para imagens de capa/OG dos artigos.

### Restrições inegociáveis (reafirmadas)

1. **Custo zero em runtime.** Nenhuma chamada a API de IA paga no servidor.
   Toda "automação" = TypeScript determinístico (slug, title, meta sugerida,
   JSON-LD, links internos, sitemap, breadcrumb, reading time, SEO score).
2. **Texto é humano.** O sistema automatiza tudo ao redor da redação, nunca a
   redação. O botão "Exportar brief" (§9) só gera um texto para o dono colar no
   ChatGPT/Claude **dele**, fora do sistema.
3. **Conteúdo no Supabase.** Publicar/editar **sem novo deploy**. O site público
   passa a ler do Supabase com ISR (`revalidate`) + fallback. Migração dos 3
   artigos hardcoded (`lib/articles.ts`) para o banco (seed na migration).
4. **PT-BR** em todo o conteúdo e UX.

---

## 1. Arquitetura de navegação

Novo grupo na `AdminNav` (`components/admin/AdminNav.tsx`), inserido após
"Relatórios":

```
Conteúdo / SEO
├── Painel SEO      /admin/seo            (BarChart3 / Search icon — visão geral)
├── Artigos         /admin/seo/artigos    (FileText)
├── Clusters        /admin/seo/clusters   (Network)
└── Landing pages   /admin/seo/landing    (LayoutTemplate)
```

Decisão: prefixo **`/admin/seo`** (não `/admin/conteudo`) porque o valor central
para o dono é "rankear no Google", e a tela-mãe é um dashboard de SEO. Os ícones
saem de `lucide-react` (já dependência).

### Mapa de rotas (App Router)

```
app/admin/seo/
├── page.tsx                      # Painel SEO (dashboard)
├── artigos/
│   ├── page.tsx                  # listagem de artigos (busca, filtro cluster, status)
│   ├── novo/page.tsx             # cria artigo vazio → redireciona p/ [id]
│   ├── [id]/page.tsx             # editor de artigo (RSC carrega dados + passa p/ client)
│   └── actions.ts                # server actions de artigo
├── clusters/
│   ├── page.tsx                  # listagem + editor master-detail (estilo Marcas)
│   └── actions.ts
├── landing/
│   ├── page.tsx                  # listagem de landing pages
│   ├── novo/page.tsx
│   ├── [id]/page.tsx             # editor de landing page
│   └── actions.ts
└── _lib/
    ├── seo-score.ts              # regras determinísticas (doc 02) — reuso server+client
    ├── links-internos.ts         # algoritmo de sugestão (doc 03)
    ├── slug.ts                   # slugify compartilhado (hoje duplicado em cada actions.ts)
    └── export-brief.ts           # gera texto do brief (opcional, §9)
```

Rotas públicas afetadas (passam a ler do Supabase — detalhe nos docs 01–03):
`app/(public)/artigos/page.tsx`, `app/(public)/artigos/[slug]/page.tsx`,
`app/sitemap.ts`, e novas `app/(public)/[landing-slug]` para landing pages.

---

## 2. Tela (a) — Painel SEO  `/admin/seo`

Dashboard de entrada. RSC, `dynamic = "force-dynamic"`. Estilo do
`app/admin/dashboard/page.tsx` (cards de métrica em grid).

```
┌─────────────────────────────────────────────────────────────────────┐
│ SEO & Conteúdo                                  [+ Novo artigo]        │
│ Gerencie artigos, clusters e landing pages do site.                   │
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│ │ Artigos  │ │ Publica- │ │ Rascu-   │ │ Score    │   (cards)        │
│ │   13     │ │ dos  10  │ │ nhos  3  │ │ médio 78 │                  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                  │
│                                                                       │
│ Cobertura de clusters (10 alvos)                                      │
│ ┌───────────────────────────────────────────────────────────────┐   │
│ │ ● Guia ferramentas eletricista   pilar ✓  3/4 clusters  ▓▓▓░    │   │
│ │ ● Furadeira vs parafusadeira      pilar ✗  0/3 clusters  ░░░░    │   │
│ │ ● Fornecedor industrial RN        pilar ✓  2/3 clusters  ▓▓░     │   │
│ │ ... (1 linha por cluster do doc de keywords)                     │   │
│ └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│ Precisa de atenção                                                    │
│ • "Manutenção de furadeiras" — sem meta description (score 54)        │
│ • "EPI para obra" — 0 links internos sugeridos aplicados              │
│ • Cluster "Bosch vs DeWalt" — pilar ainda não escrito                 │
└─────────────────────────────────────────────────────────────────────┘
```

- **Cards de métrica:** total de artigos, publicados, rascunhos, **score médio**
  (média do `seo_score` calculado — doc 02). Reusa o markup de card do dashboard.
- **Cobertura de clusters:** lista os 10 clusters-alvo (semeados a partir do doc
  de keywords). Cada linha mostra se o **pilar** existe, quantos artigos de
  cluster já foram publicados (`X/Y`) e uma barra de progresso. Esta é a bússola
  editorial: o dono vê o que falta escrever.
- **Precisa de atenção:** lista derivada das regras determinísticas — artigos
  com score baixo, sem meta, sem links aplicados, clusters sem pilar. Cada item
  é um link direto para o editor relevante.

---

## 3. Tela (b1) — Listagem de artigos  `/admin/seo/artigos`

Molde: `app/admin/produtos/page.tsx` (RSC + searchParams + tabela + badges).

```
┌─────────────────────────────────────────────────────────────────────┐
│ Artigos                                          [+ Novo artigo]       │
│ 13 no total · 10 publicados                                           │
├─────────────────────────────────────────────────────────────────────┤
│ [ Buscar título/slug ]  [ Cluster ▾ ]  [ Status ▾ ]      [ Filtrar ]  │
├─────────────────────────────────────────────────────────────────────┤
│ TÍTULO                        CLUSTER          SCORE  STATUS   ATUALIZ.│
│ ───────────────────────────────────────────────────────────────────  │
│ Como escolher o EPI certo…    EPI para obras   ▓ 86  ● public  há 2d   │
│ Manutenção de furadeiras…     Manutenção elét. ▓ 54  ● public  há 5d   │
│ Kit ferramentas eletricista   Eletricista      ▓ 91  ◐ rascun  há 1h   │
│ ...                                                          Editar →  │
└─────────────────────────────────────────────────────────────────────┘
```

Colunas: **Título** (link p/ editor), **Cluster** (nome ou "—"), **Pilar?**
(badge se for o pilar do cluster), **Score** (badge colorido reusando a lógica
`scoreCor()` do enriquecimento: ≥80 verde, 50–79 âmbar, <50 vermelho),
**Status** (`publicado`/`rascunho` — badges `bg-green-100`/`bg-zinc-200` já
usados em produtos), **Atualizado em**, ação **Editar →**.

Filtros (querystring, RSC): `q` (busca por título/slug, `ilike`), `cluster`
(select de clusters), `status` (todos/publicado/rascunho). Mesmo padrão de
`<form>` GET de produtos. Paginação idêntica.

Botão **"+ Novo artigo"** → `/admin/seo/artigos/novo` (cria row rascunho vazio e
redireciona para `[id]`, igual `createProdutoAction` → `redirect`).

---

## 4. Tela (b2) — Editor de artigo  `/admin/seo/artigos/[id]`

A tela mais importante. Layout de **3 zonas** num grid
`grid lg:grid-cols-[minmax(0,1fr)_360px]`:

- **Coluna esquerda (principal):** abas "Conteúdo" e "SEO & Metadados".
- **Coluna direita (fixa, `sticky top-6`):** painel vivo de **SEO Score** +
  **Previews** + **Links internos**.

A barra superior é uma **toolbar sticky** com: voltar, status (Rascunho/Publicado
como toggle/segmented), "Ver no site" (abre `/artigos/[slug]` em nova aba só se
publicado), "Salvar". Salvar usa `useActionState` (igual ProdutoForm); o status
publica/despublica sem novo deploy (apenas grava no Supabase + `revalidatePath`
e `revalidateTag`).

```
┌── ← Voltar ── Editor de artigo ──────── [Rascunho|Publicado] [Ver] [Salvar] ─┐
│                                                                              │
│  ┌─ Conteúdo │ SEO & Metadados ─┐        ┌─ SEO Score ──────────────────┐   │
│  │                              │        │            78 / 100   ◐       │   │
│  │  Título                      │        │  ✓ Título 52 car. (ok)        │   │
│  │  [____________________]      │        │  ✓ Meta 142 car. (ok)         │   │
│  │                              │        │  ✓ H1 presente                │   │
│  │  Slug   /artigos/[ ____ ] 🔒 │        │  ✓ 4 H2 (≥2)                  │   │
│  │                              │        │  ✗ Keyword no 1º parágrafo    │   │
│  │  ── Blocos ──────────────    │        │  ✓ FAQ com 3 perguntas        │   │
│  │  ⠿ [H2] O que é EPI…    ✎ 🗑 │        │  ✓ Imagem de capa com alt     │   │
│  │  ⠿ [P]  EPI é todo dis… ✎ 🗑 │        │  ⚠ 0 de 5 links aplicados     │   │
│  │  ⠿ [•]  Lista (6 itens)✎ 🗑 │        └──────────────────────────────┘   │
│  │  ⠿ [P]  Fornecer o EPI… ✎ 🗑 │        ┌─ Prévia no Google ───────────┐   │
│  │  [+ Parágrafo][+ Título][+•] │        │ natalmaq.com.br › artigos     │   │
│  │                              │        │ Como escolher o EPI certo…    │   │
│  └──────────────────────────────┘       │ Escolher o EPI certo protege… │   │
│                                          └──────────────────────────────┘   │
│                                          ┌─ Card de compartilhamento ───┐   │
│                                          │ [img capa]                    │   │
│                                          │ COMO ESCOLHER O EPI CERTO…    │   │
│                                          └──────────────────────────────┘   │
│                                          ┌─ Links internos sugeridos ───┐   │
│                                          │ "EPI" → /catalogo?cat=epi  ✓✗ │   │
│                                          │ "furadeira" → /produto/…   ✓✗ │   │
│                                          └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Aba "Conteúdo" — editor de blocos (reaproveita `ArticleBlock`)

Mantemos o tipo atual de `lib/articles.ts`:

```ts
type ArticleBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };
```

Editor visual de blocos, **drag-and-drop** com `@dnd-kit/sortable` (mesmo motor
do Kanban). Componente novo `BlocksEditor` (client):

- Estado local `blocks: ArticleBlock[]`; serializado para um hidden input JSON no
  submit (mesmo truque do `ProdutoForm` com `imagens.join("\n")`, só que JSON).
- `SortableContext` + `useSortable` por bloco; handle de arrasto `⠿`
  (`GripVertical` do lucide). `arrayMove` no `onDragEnd`.
- Cada bloco: badge do tipo (`H2`/`P`/`•`), campo de edição inline
  (`textarea` auto-grow para heading/paragraph; lista = uma linha por item, igual
  o textarea de imagens do produto), botões Editar/Apagar.
- Barra inferior com **"+ Parágrafo" / "+ Título (H2)" / "+ Lista"** que
  empurram um bloco vazio do tipo certo.
- O título do artigo (H1) é campo separado (não é bloco), igual ao modelo atual
  onde `title` ≠ `content`.

Decisão de escopo: **NÃO** introduzir rich-text (negrito/links inline) agora —
manteria compatibilidade com o render público atual que só conhece
heading/paragraph/list. Links inline são resolvidos pela **linkagem automática**
(§7), não por edição manual, mantendo custo/complexidade baixos. (Extensão
futura possível: bloco `quote` e bloco `image` — fora de escopo deste doc.)

### Aba "SEO & Metadados" — campos

Helper `<Field>` + classe `input` reaproveitados. Campos:

| Campo | Tipo | Comportamento |
|---|---|---|
| **Título** | text | dispara sugestão de slug e meta (se vazios) |
| **Slug** | text + cadeado | auto de `slugify(título)`; editável; aviso se mudar um slug já publicado (quebra link) |
| **Meta description** | textarea | **contador ao vivo** `0/160` com cor: verde 120–158, âmbar fora, vermelho >160 |
| **Excerpt** | textarea | usado no card/índice; default = meta se vazio |
| **Categoria (rótulo)** | select/text | o `category` atual ("Segurança", "Manutenção", "Guia de compra") |
| **Cluster** | select | vincula ao cluster (FK); define pilar↔cluster e linkagem |
| **É o pilar deste cluster?** | checkbox | marca como artigo-pilar |
| **Palavra-chave primária** | text | usada no SEO score (presença em título/1º parágrafo/H2) |
| **Palavras-chave secundárias** | tags/text | uma por linha; viram `keywords[]` no schema/metadata |
| **Autor** | text | default "Equipe Natalmaq" |
| **Data de publicação** | date | gera `date` (pt-BR) e `isoDate` (server) |
| **Imagem de capa** | upload | bucket `conteudo`; `uploadParaBucket` |
| **Alt da capa** | text | **obrigatório para score** (acessibilidade + SEO) |
| **Imagem OG** | upload (opcional) | default = capa se vazio |
| **FAQ** | repeater | §5 |
| **HowTo** | repeater | §5 |
| **Status** | toggle | rascunho/publicado (também na toolbar) |

`reading_time` é **calculado** (não digitado): contagem de palavras dos blocos
/ 200 ppm, server-side. Remove o campo manual atual.

---

## 5. Repeaters de FAQ e HowTo (alimentam o Schema rico)

Dois repeaters na aba SEO. Padrão visual: cartões empilhados com "+ Adicionar"
e remover, mesma estética dos blocos. Servem **só** para gerar JSON-LD `FAQPage`
e `HowTo` (doc 02) — não precisam de DnD (ordem natural de criação basta, mas
HowTo pode ter setas ↑/↓ simples já que ordem importa nos passos).

**FAQ** (`faq: { q: string; a: string }[]`):
```
Perguntas frequentes
┌──────────────────────────────────────────────┐
│ Pergunta  [ O EPI é obrigatório por lei? ]  🗑 │
│ Resposta  [ Sim. A NR-6 obriga o fornecimen…] │
└──────────────────────────────────────────────┘
[+ Adicionar pergunta]
```

**HowTo** (`howto: { name: string; steps: { text: string }[] } | null`):
```
Passo a passo (HowTo)        [✓ Gerar schema HowTo]
Nome  [ Como escolher o EPI por etapa ]
1. [ Faça a análise de risco da atividade ]   ↑ ↓ 🗑
2. [ Liste os EPIs por parte do corpo ]       ↑ ↓ 🗑
[+ Adicionar passo]
```

Ambos opcionais. Quando preenchidos, entram no `@graph` do JSON-LD do artigo
público junto de `Article` + `BreadcrumbList` (já existentes em
`app/(public)/artigos/[slug]/page.tsx`). Persistência: colunas `jsonb` na tabela
de artigos (modelagem no doc 01).

---

## 6. Painel "SEO Score / Checklist" ao vivo + Previews (tela c do enunciado)

Coluna direita do editor, `sticky`. **Tudo client-side e determinístico** —
nenhuma chamada de rede, recalcula a cada keystroke (debounce ~300ms).

### 6.1 SEO Score

Componente `SeoScorePanel` consome `lib/.../_lib/seo-score.ts`, uma função pura
**compartilhada server+client** (a mesma roda no `page.tsx` da listagem para o
score médio, garantindo consistência). Contrato:

```ts
// _lib/seo-score.ts  (regras concretas no doc 02 — aqui o shape de UI)
type SeoCheck = {
  id: string;
  label: string;            // PT-BR
  status: "ok" | "warn" | "fail";
  weight: number;
  hint?: string;            // como corrigir
};
type SeoResult = { score: number; checks: SeoCheck[] };

export function computeSeoScore(input: {
  title: string;
  slug: string;
  metaDescription: string;
  blocks: ArticleBlock[];
  primaryKeyword: string;
  coverAlt: string;
  coverImage: string | null;
  faq: { q: string; a: string }[];
  appliedInternalLinks: number;
  suggestedInternalLinks: number;
}): SeoResult;
```

Checklist exibido (cada item = ✓/⚠/✗ + dica ao passar o mouse):

1. **Título** entre 30–60 caracteres.
2. **Meta description** entre 120–160 caracteres.
3. **H1 presente** (= título não vazio).
4. **≥2 H2** (blocos `heading`).
5. **Keyword primária no título.**
6. **Keyword primária no primeiro parágrafo.**
7. **Keyword primária em ao menos 1 H2.**
8. **FAQ com ≥3 perguntas.**
9. **Imagem de capa com alt** preenchido.
10. **Links internos:** "X de Y sugeridos aplicados" (≥1 = ok).

O número grande (0–100) é a soma ponderada. Mesmo `scoreCor()` do enriquecimento
para a cor do anel/badge.

### 6.2 Preview do snippet do Google (`GoogleSnippetPreview`)

Renderiza, com tipografia aproximada do Google:
- breadcrumb URL: `natalmaq.com.br › artigos › <slug>`
- título em azul (truncado em ~60 char)
- meta description em cinza (truncada em ~160 char)

Atualiza ao vivo com título/slug/meta. Mostra o **mesmo truncamento** que o
Google faz, para o dono "ver onde corta".

### 6.3 Preview do card OG (`OgCardPreview`)

Cartão 1200×630 reduzido: imagem OG/capa no topo, título em `font-display`
maiúsculo, domínio embaixo — imitando o card real do WhatsApp/Facebook. Usa o
look "Indústria" (navy + brand-500) para fidelidade ao site.

---

## 7. Pré-visualização e aprovação de links internos automáticos (tela d / doc 03)

O sistema sugere links determinísticos (artigo → produto/categoria/marca/outro
artigo) casando **palavras-chave/slug** no texto dos blocos. A UI segue
**exatamente** o molde de `RevisaoList.tsx` (aprovar/rejeitar com `Set` de
resolvidos), mas embutida no editor.

### Onde aparece

1. No painel direito do editor: cartão **"Links internos sugeridos"** com a
   contagem e um link "Revisar (N)".
2. Modal/drawer **"Revisar links internos"** antes de publicar (gate opcional,
   recomendado): lista cada sugestão.

```
Revisar links internos sugeridos (5)
┌────────────────────────────────────────────────────────────┐
│ Trecho:  "…todos os EPIs comercializados têm CA ativo…"      │
│ Âncora:  "EPI"            →  /catalogo?categoria=epi          │
│ Tipo:    categoria · confiança ▓ alta                        │
│                                   [ Aceitar ]  [ Rejeitar ]  │
├────────────────────────────────────────────────────────────┤
│ Trecho:  "…uma furadeira ou parafusadeira de qualidade…"     │
│ Âncora:  "furadeira"      →  /produto/furadeira-bosch-gsb…   │
│ Tipo:    produto · confiança ▓ média                         │
│                                   [ Aceitar ]  [ Rejeitar ]  │
└────────────────────────────────────────────────────────────┘
[ Aceitar todos de alta confiança ]      [ Concluir ]
```

- Cada item: trecho com a âncora destacada, destino, **tipo** (produto /
  categoria / marca / artigo) e **confiança** (badge colorido reusando
  `scoreCor()`).
- Ações: **Aceitar** / **Rejeitar** por item; atalho **"Aceitar todos de alta
  confiança"**.
- Decisões persistem como `applied_internal_links` (jsonb) no artigo. O render
  público aplica só os links **aceitos** (transformando a âncora em `<a>` no
  parágrafo correspondente — lógica de render no doc 03).
- **Idempotência:** ao reabrir, sugestões já aceitas/rejeitadas não voltam à
  fila (mesmo `Set` de resolvidos). Rejeitar é lembrado (lista de "ancoras
  bloqueadas" por artigo) para o algoritmo não re-sugerir.

Contrato do gerador (puro, server):
```ts
// _lib/links-internos.ts
type LinkSugestao = {
  blockIndex: number;
  anchor: string;
  href: string;
  tipo: "produto" | "categoria" | "marca" | "artigo";
  confianca: number;        // 0..100
};
export function sugerirLinks(
  blocks: ArticleBlock[],
  dicionario: { termo: string; href: string; tipo: LinkSugestao["tipo"] }[],
): LinkSugestao[];
```
O `dicionario` é montado server-side a partir do Supabase (slugs de produtos,
categorias, marcas, e títulos/keywords de outros artigos) — custo zero, só
leitura.

---

## 8. Tela (c do enunciado original) — Editor de cluster/pilar  `/admin/seo/clusters`

Master-detail no molde de `MarcasManager.tsx` (`grid lg:grid-cols-[1fr_400px]`):
lista à esquerda, form à direita.

```
┌─ Clusters ─────────────────────────┐  ┌─ Editar: Eletricista ──────────┐
│ NOME            PILAR  ARTIGOS  ST. │  │ Nome  [ Guia ferramentas elet…]│
│ Eletricista      ✓      4     ●    │  │ Slug  [ ferramentas-eletricista]│
│ Furadeira×Paraf  ✗      0     ◐    │  │ Keyword principal              │
│ Fornecedor RN    ✓      3     ●    │  │   [ kit ferramentas eletricista]│
│ Bosch×DeWalt     ✗      0     ◐    │  │ Keywords secundárias           │
│ ...                                 │  │   [ alicate isolado nr10        ]│
│                                     │  │   [ ferramentas para eletricista]│
│                                     │  │ Descrição (intro do hub)        │
│                                     │  │   [ textarea ]                  │
│                                     │  │ Artigo-pilar  [ select artigo ▾]│
│                                     │  │ Ordem  [ 1 ]    ☑ Ativo         │
│                                     │  │           [ Salvar ] [Cancelar] │
└─────────────────────────────────────┘  └─────────────────────────────────┘
```

Campos do cluster: nome, slug (auto), keyword principal, keywords secundárias,
descrição (intro do hub/pilar), artigo-pilar (select dos artigos do cluster),
ordem, ativo. Os 10 clusters do doc de keywords vêm **semeados** numa migration,
então o dono já abre a tela com a estrutura pronta e só vincula artigos.

Saída pública (doc 01/02): a **página-pilar** lista os artigos do cluster com
JSON-LD `ItemList`/`CollectionPage`, e cada artigo do cluster linka de volta ao
pilar (linkagem hub-and-spoke automática).

---

## 9. Tela (d do enunciado) — Editor de landing page B2B/local  `/admin/seo/landing`

Listagem (`/admin/seo/landing`, molde produtos) + editor full-page
(`/admin/seo/landing/[id]`, molde do editor de artigo, **sem** repeater de FAQ
obrigatório mas com os mesmos previews/score).

Landing pages B2B/local atacam keywords de intenção comercial dos clusters 3 e 4
("comprar ferramentas natal rn", "compra b2b ferramentas industriais",
"distribuidor industrial natal rn", "ferramentas para empresa natal rn").
Renderizam em rota própria de alto valor (ex.: `/comprar-ferramentas-natal-rn`).

Campos do editor de landing:
- **Tipo:** `b2b` | `local` (define template público e schema).
- **Título / H1**, **slug** (rota raiz própria), **meta**, **keyword primária**.
- **Hero:** headline, subheadline, **CTA** (texto + destino: WhatsApp `wa.me`
  via `lib/whatsapp.ts` ou `/catalogo`).
- **Blocos** (reusa `BlocksEditor`): benefícios, prova, área de cobertura.
- **Bloco "Vitrine de produtos":** seletor de produtos/categorias em destaque
  (gera `ItemList` no schema, reusa `listProdutos`/`listCategorias`).
- **Bloco local (se tipo=local):** endereço/horário de `lib/loja.ts`
  (`LOJA_ENDERECO`, `LOJA_HORARIO`) → reforça `LocalBusiness`/`Store` schema.
- **FAQ** (mesmo repeater) — opcional.
- Score + previews + links internos: **mesmos componentes** do editor de artigo.

Schema gerado (doc 02): `WebPage`/`CollectionPage` + `BreadcrumbList` +
`ItemList` (vitrine) + reforço `LocalBusiness` para tipo local. O `Store`
sitewide de `app/layout.tsx` permanece.

---

## 10. Fluxo de criação 100% manual e bem assistido (sem IA paga)

Sequência que o dono segue (a UI guia em cada passo):

1. **Painel SEO** mostra qual cluster está descoberto → decide o que escrever.
2. **+ Novo artigo** → escolhe o **cluster** (puxa keyword primária/secundárias
   automaticamente como sugestão).
3. Digita o **título** → o sistema **sugere slug e meta** (determinístico) que o
   dono ajusta. Contador de meta ao vivo evita erro de tamanho.
4. Escreve o corpo no **editor de blocos** (drag-and-drop, adiciona H2/parágrafo/
   lista). O **SEO Score** sobe em tempo real e diz exatamente o que falta
   ("falta keyword no 1º parágrafo", "adicione mais 1 H2").
5. Preenche **FAQ/HowTo** (opcionais, mas o score recompensa).
6. Sobe **imagem de capa** + escreve o **alt**.
7. Abre **"Revisar links internos"** → aceita/rejeita as sugestões.
8. Confere os **previews** (Google + card OG).
9. Vira o toggle para **Publicado** → grava no Supabase, `revalidatePath` +
   `revalidateTag`, **sem deploy**. Sitemap e índice atualizam no próximo ISR.

Nada nesse fluxo chama IA. A "assistência" é: sugestões determinísticas, checklist
acionável, previews fiéis e aprovação de links.

### 9-opcional — Botão "Exportar brief" (sem IA no runtime)

Botão secundário na toolbar do editor: **"Exportar brief de redação"**. Chama
`_lib/export-brief.ts` (função pura) que monta um **texto/markdown** estruturado
e copia para a área de transferência (`navigator.clipboard`). Conteúdo do brief:

```
Escreva um artigo para o blog da Natalmaq (loja B2B de ferramentas em Natal/RN).
Cluster: <nome> | Keyword primária: <kw> | Secundárias: <kw, kw>
Título alvo: <título atual ou sugestão>
Público: profissionais da construção/indústria, tom prático PT-BR, sem emojis.
Estrutura desejada: 1 intro, 4–6 H2, listas onde fizer sentido, 3 FAQs.
Inclua menções naturais a: <produtos/categorias do dicionário de links>.
Não invente preços. CTA final: orçamento via WhatsApp.
Cole o texto de volta no editor de blocos.
```

O dono cola **no ChatGPT/Claude dele** (fora do sistema, custo zero para a
Natalmaq), traz o texto pronto e cola nos blocos. **Não implementamos IA no
servidor** — é só geração de string + clipboard. Documentado como ideia
opcional; pode ficar atrás de uma flag e ser entregue depois do MVP.

---

## 11. Componentes, server actions e o que reaproveitar

### Componentes novos (client salvo indicação)

| Componente | Local | Reaproveita de |
|---|---|---|
| `ArtigoEditor` | `app/admin/seo/artigos/[id]/ArtigoEditor.tsx` | `ProdutoForm` (useActionState, Field, input, upload, toasts) |
| `BlocksEditor` | `app/admin/seo/_components/BlocksEditor.tsx` | `KanbanBoard` (dnd-kit) + `@dnd-kit/sortable` |
| `SeoScorePanel` | `app/admin/seo/_components/SeoScorePanel.tsx` | `scoreCor()` do enriquecimento |
| `GoogleSnippetPreview` | `app/admin/seo/_components/GoogleSnippetPreview.tsx` | — (novo, puro) |
| `OgCardPreview` | `app/admin/seo/_components/OgCardPreview.tsx` | look "Indústria" do artigo público |
| `FaqRepeater` / `HowToRepeater` | `app/admin/seo/_components/` | padrão de imagens do ProdutoForm |
| `InternalLinksReview` | `app/admin/seo/_components/InternalLinksReview.tsx` | `RevisaoList` (aprovar/rejeitar + Set) |
| `MetaCounter` | `app/admin/seo/_components/MetaCounter.tsx` | — (textarea + contador) |
| `ClustersManager` | `app/admin/seo/clusters/ClustersManager.tsx` | `MarcasManager` (master-detail) |
| `LandingEditor` | `app/admin/seo/landing/[id]/LandingEditor.tsx` | `ArtigoEditor` |
| `ProdutoPicker` | `app/admin/seo/_components/ProdutoPicker.tsx` | busca em `listProdutos` |

Reaproveitar direto: `AdminNav` (add grupo), helper `<Field>` + const `input`
(extrair para `app/admin/_lib/form-ui.tsx` para parar de duplicar entre forms),
`uploadParaBucket` (+ bucket `conteudo`), `slugify` (extrair para `_lib/slug.ts`,
hoje copiado em produtos/marcas).

### Libs puras novas (server + client, custo zero)

- `app/admin/seo/_lib/seo-score.ts` — `computeSeoScore` (doc 02).
- `app/admin/seo/_lib/links-internos.ts` — `sugerirLinks` (doc 03).
- `app/admin/seo/_lib/slug.ts` — `slugify` compartilhado.
- `app/admin/seo/_lib/reading-time.ts` — palavras/200.
- `lib/articles.ts` evolui: passa a **ler do Supabase** (`getArticleBySlug`,
  `listArticles`, `listArticlesByCluster`) com `revalidate`/`unstable_cache` e
  fallback. Mantém o tipo `Article`/`ArticleBlock` para não quebrar o render.

### Server actions

`app/admin/seo/artigos/actions.ts`:
- `createArtigoAction` → cria rascunho vazio, `redirect` p/ `[id]`.
- `updateArtigoAction(id, prev, formData)` → salva campos + blocos (JSON) +
  faq/howto (JSON) + meta + keywords; `revalidatePath`/`revalidateTag`.
- `setStatusArtigoAction(id, status)` → publica/despublica (revalida público).
- `deleteArtigoAction(id)`.
- `aplicarLinkAction(id, sugestao)` / `rejeitarLinkAction(id, anchor)` → persiste
  decisão de link (idempotente).
- `uploadCapaAction` → `uploadParaBucket("conteudo", fd)`.

`app/admin/seo/clusters/actions.ts`: `saveClusterAction`, `deleteClusterAction`
(molde marcas).

`app/admin/seo/landing/actions.ts`: `createLandingAction`, `updateLandingAction`,
`setStatusLandingAction`, `deleteLandingAction`.

Todas seguem o padrão existente: `"use server"`, retorno `{ ok?, error? }`,
`revalidatePath`. RLS via `is_admin()` cobre as tabelas novas automaticamente
(grants padrão da migration `0016`). Persistência das tabelas (`artigos`,
`clusters`, `landing_pages`) + seed dos 3 artigos e 10 clusters: doc 01
(migration nova `0019_seo_conteudo.sql`, com triggers `set_updated_at` e policies
`admin all <tabela>` no padrão `0002`).

---

## 12. Acessibilidade, estados vazios e erros

- **Estados vazios:** cada lista repete o padrão `Nenhum X cadastrado.`
  (produtos/marcas) com CTA para criar.
- **Erros/sucesso:** toasts inline `bg-red-50`/`bg-green-50` (padrão dos forms).
- **Confirmação destrutiva:** `confirm()` para apagar (igual ProdutoForm/Marcas).
- **Aviso de slug publicado:** ao editar slug de artigo publicado, banner âmbar
  "Alterar o endereço pode quebrar links existentes."
- **Loading:** `pending` do `useActionState`/`useTransition` desabilita botões
  ("Salvando…").
- **Teclado:** dnd-kit já dá sensores; handles com `aria-label`.

---

## 13. Resumo de entregáveis (para os docs de implementação 01–04)

- **Rotas:** `/admin/seo` (+ `artigos`, `clusters`, `landing` e subrotas).
- **Migration:** `0019_seo_conteudo.sql` — tabelas `artigos`, `clusters`,
  `landing_pages` (+ jsonb para blocos/faq/howto/links), policies `is_admin()`,
  triggers `set_updated_at`, bucket `conteudo`, **seed** dos 3 artigos atuais e
  dos 10 clusters do doc de keywords.
- **Libs puras:** `seo-score.ts`, `links-internos.ts`, `slug.ts`,
  `reading-time.ts`, `export-brief.ts` (opcional).
- **Público (sem deploy p/ editar):** `lib/articles.ts` lê do Supabase;
  `app/(public)/artigos/*` e `app/sitemap.ts` consomem o banco; novas rotas de
  pilar e landing; JSON-LD enriquecido (FAQPage/HowTo/ItemList).
- **Custo:** zero em runtime. Nenhuma dependência paga. Só Supabase free tier e
  TypeScript determinístico.
