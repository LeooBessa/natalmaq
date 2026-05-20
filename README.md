# Natalmaq — Portal B2B de Orçamento

Plataforma de orçamento digital com identidade industrial. Cliente monta a cesta, vê preço/estoque/frete em tempo real e finaliza por deeplink `wa.me`. Admin gerencia catálogo (Kanban + CRUDs), pedidos e importa preço/estoque em massa via planilha **ou PDF do Delphi Sistemas** com auto-categorização e auto-agrupamento de variantes.

🌐 **Produção:** https://natalmaq-main.vercel.app

## Stack

| Camada       | Tecnologia                                                                  |
| ------------ | --------------------------------------------------------------------------- |
| Frontend     | Next.js 15 (App Router) + TypeScript + Tailwind                             |
| Design       | "Indústria" — navy + laranja, Archivo Black + JetBrains Mono                |
| Backend      | FastAPI (Python) — funções serverless na Vercel (`/api/*`)                  |
| Banco        | Supabase Postgres + RLS + tsvector (busca full-text)                        |
| Auth admin   | Supabase Auth (email/senha) + middleware Next.js                            |
| Storage      | Supabase Storage (`produtos`, `marketing`, `imports`)                       |
| PDF parsing  | `pdfjs-dist` (legacy build) + heurísticas em `lib/pdf-parser.ts`            |
| Variantes    | Clustering por prefixo de palavras em `lib/agrupador.ts`                    |
| WhatsApp     | Deeplink `wa.me` (mensagem pré-formatada, isolada em `lib/whatsapp.ts`)     |

## Estrutura

```
.
├── app/
│   ├── (public)/           # Loja pública (home, catálogo, produto, carrinho, checkout, sobre)
│   └── admin/              # Painel admin (auth + CRUDs + Kanban + importar)
├── components/
│   ├── catalog/            # ProductCard, SearchAutocomplete, BannerCarousel
│   ├── produto/            # ProdutoComVariantes, AddToCartBlock
│   ├── Header.tsx + NavStrip.tsx + Footer.tsx
├── lib/
│   ├── data.ts             # Server reads (Supabase anon)
│   ├── supabase/           # client/server helpers (anon + service-role)
│   ├── cart-store.ts       # Zustand persistido (localStorage)
│   ├── whatsapp.ts         # buildOrderMessage + buildWaLink
│   ├── pdf-parser.ts       # PDF Delphi → linhas de produto
│   └── agrupador.ts        # Categorias auto + clustering de variantes
├── api/                    # FastAPI Python (Vercel serverless)
│   ├── core/               # settings, supabase service-role, schemas
│   └── routers/            # produtos, busca, marcas/categorias, frete, pedidos
├── supabase/migrations/    # SQL versionado (0001_init → 0004_variantes)
├── public/brand/           # Logos (mark + lockup)
├── types/                  # TypeScript shared types
├── vercel.json             # Rewrites /api/* → api/index.py
└── .env.example            # Template de envs
```

## Setup em outra máquina (passo-a-passo)

### 1) Clonar e instalar dependências

```bash
git clone https://github.com/<sua-conta>/natalmaq.git
cd natalmaq
npm install
```

### 2) Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha `.env.local` com:

- **Supabase** (Settings → API):
  - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser)
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (server)
- **Loja:** `NEXT_PUBLIC_LOJA_WHATSAPP` (formato `5584999999999`), nome, cidade
- **Site:** `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (em prod = `https://natalmaq-main.vercel.app`)

> Atalho na máquina nova: se já tiver `vercel link` feito (passo 5), use `vercel env pull .env.local` para baixar todas as envs configuradas em produção.

### 3) Aplicar migrations no Supabase

Quatro migrations precisam ser executadas (em ordem):

```
supabase/migrations/0001_init.sql              # schema base + RLS + seed
supabase/migrations/0002_admin.sql             # admins + bucket produtos
supabase/migrations/0003_imports_e_buckets.sql # imports + buckets marketing/imports
supabase/migrations/0004_variantes.sql         # produto_pai_id + variante_label
```

**Forma A — Supabase CLI:**
```bash
supabase login
supabase link --project-ref yfvmjxrtygojnlnkxtmu
supabase db push
```

**Forma B — Painel web:** copie o SQL de cada arquivo e cole em SQL Editor → Run.

### 4) Rodar o frontend

```bash
npm run dev
```

`http://localhost:3000` — loja pública  
`http://localhost:3000/admin/login` — painel admin

> Para rodar o backend Python local junto, use `vercel dev` (precisa de `pip install -r api/requirements.txt`). Em dev, as chamadas `/api/*` do Next são roteadas para `http://localhost:8000` via rewrite. Em produção, a Vercel serve o Python diretamente.

### 5) Vincular o projeto Vercel (para deploy)

```bash
npm i -g vercel
vercel link        # use projeto existente "natalmaq"
vercel env pull .env.local   # baixa as envs já configuradas
```

A pasta `.vercel/` (que é gitignored) guarda o link do projeto. Cada máquina precisa rodar `vercel link` uma vez.

### 6) Deploy

**Forma A — manual via CLI:**
```bash
vercel --prod
```

**Forma B — auto-deploy a cada push (recomendado):**

1. Instale o [app Vercel para GitHub](https://github.com/apps/vercel/installations/new), autorizando o repositório `araujo19con/natalmaq`.
2. Conecte o projeto Vercel ao repo:
   ```bash
   vercel git connect
   ```
3. Daí em diante todo `git push origin main` faz deploy automático.

A Vercel detecta automaticamente:
- `app/` → Next.js (`next build`)
- `api/index.py` + `vercel.json` → função Python serverless (`@vercel/python@4.3.1`)

## Funcionalidades

### Loja pública
- **Header** com utility bar, busca com autocomplete, contador de orçamento, navegação por categorias/marcas/promoções/em-estoque (dropdowns funcionais)
- **Home** com hero industrial + grid de categorias + destaques + CTA strip
- **Catálogo** com filtros por categoria/marca/disponibilidade/promoção, chips ativos, paginação
- **Produto** com galeria, seletor de variantes (modal de tamanho/característica), ficha técnica, preço com desconto
- **Carrinho** Zustand persistido em localStorage
- **Checkout** com cálculo de frete por CEP + criação de pedido + redirect para WhatsApp da loja

### Admin (`/admin`)
- Login Supabase Auth
- Dashboard com métricas (orçamentos hoje/semana/mês, status counts)
- **Pedidos** lista com filtros + página individual com aprovar/recusar/copiar texto/abrir wa.me cliente
- **Kanban** drag-and-drop (`@dnd-kit`) entre colunas pendente/aprovado/enviado/recusado
- CRUDs: produtos, marcas, categorias, banners (com upload de imagem)
- **Importar planilha** (CSV/XLSX) — 11 colunas reconhecidas
- **Importar PDF Delphi** — 11.799 produtos em ~4s, com:
  - Auto-categorização pela primeira palavra
  - Auto-criação de marcas faltantes
  - **Auto-agrupamento de variantes** (70% dos produtos clusterizados em famílias)
  - Batch upsert de 500 linhas por vez

## Comandos úteis

```bash
npm run dev               # frontend isolado (rápido)
vercel dev                # frontend + backend Python no mesmo host
npm run build             # build de produção
npx tsc --noEmit          # type-check
vercel logs <url>         # logs do deploy
vercel ls --prod natalmaq # lista deploys de produção
```

## Notas técnicas

- **PDF parsing:** `pdfjs-dist` v4 com fake worker pré-carregado em `globalThis.pdfjsWorker`. Estratégia híbrida (regex p/ código/preço/ICMS + posição X p/ separar descrição de fabricante). Em deploys, se a função Vercel estourar 250MB, use `vercel --prod --force` para limpar cache.
- **RLS:** leitura pública só em `produtos.ativo IS TRUE`. Admin é checado via função `public.is_admin()` SECURITY DEFINER em todas as policies.
- **Variantes:** o catálogo público filtra por `produto_pai_id IS NULL` (mostra só pais). Filhos aparecem como pílulas no seletor da página do pai.
- **Body limit Server Actions:** `next.config.ts` define `experimental.serverActions.bodySizeLimit: "10mb"` (PDF de 1.5MB não cabe no default de 1mb).
- **WhatsApp:** isolado em `lib/whatsapp.ts` + `api/routers/pedidos.py:_build_message`. Para migrar para Cloud API (Meta), trocar implementação sem tocar UI.
- **Cart key:** `natalmaq-cart-v1`. Incrementar versão ao mudar formato.

## Roadmap

- ✅ Fase 1 — Loja pública + carrinho + checkout WhatsApp + frete por CEP
- ✅ Fase 2 — Admin (auth, dashboard, pedidos, CRUDs, lista filtrada)
- ✅ Fase 3 — Kanban + importação CSV/XLSX/PDF + variantes automáticas
- ✅ Design "Indústria" aplicado (navy + laranja + Archivo Black + abas funcionais com mega-menu)
- 🔜 Avaliações com moderação no admin
- 🔜 Versão mobile mais densa (atualmente responsivo, mas pode ganhar drawer-menu)
- 🔜 Integração WhatsApp Cloud API (substituir deeplink quando volume justificar)
