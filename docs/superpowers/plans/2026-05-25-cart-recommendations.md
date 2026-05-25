# Cart Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma seção "Pode te interessar" com até 3 produtos correlatos na página `/carrinho` do natalmaq-nextjs, calculada via RPC Postgres (cascata complementares → categoria → marca, score binário em categoria/marca e acumulado em complementares).

**Architecture:** Migration SQL nova com função `public.recomendar_para_carrinho(uuid[], int)`, novo endpoint FastAPI `GET /api/produtos/recomendacoes` que chama a RPC, e novo Client Component `CartRecommendations.tsx` que lê o cart do zustand, debounce 300ms, fetch com `AbortController`, render via `ProductCard` existente.

**Tech Stack:** Postgres (SQL function, RLS-aware via SECURITY INVOKER), FastAPI (Python 3.13), supabase-py, Next.js 15 App Router (Client Component), Zustand, Tailwind CSS.

**Spec de referência:** [docs/superpowers/specs/2026-05-25-cart-recommendations-design.md](../specs/2026-05-25-cart-recommendations-design.md)

---

## Pré-requisitos

- Ambiente dev rodando: `npm run dev` em :3000 e `uvicorn api.index:app --reload --port 8000` em :8000 (ver `memory/dev-setup.md`).
- `.env` e `.env.local` populados com credenciais Supabase do projeto `yfvmjxrtygojnlnkxtmu`.
- Branch atual: `master` limpo (checar com `git status`).
- Migration anterior aplicada (`0011_fix_function_search_path.sql` é a última no schema).

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/0012_recomendacoes.sql` | Criar | Função SQL `recomendar_para_carrinho` + grant pra anon/authenticated |
| `supabase/tests/recomendacoes.test.sql` | Criar | Smoke tests SQL (3 cenários) rodáveis via psql/SQL Editor |
| `api/routers/produtos.py` | Editar | Adicionar endpoint `/produtos/recomendacoes` **antes** do `/{slug}` (ordem importa, FastAPI resolve por ordem de declaração) |
| `components/carrinho/CartRecommendations.tsx` | Criar | Client Component que orquestra fetch + render |
| `app/(public)/carrinho/page.tsx` | Editar | Importar e renderizar `<CartRecommendations />` entre header e ternário lista/vazio |

---

## Task 1: Branch e migration SQL

**Files:**
- Create: `supabase/migrations/0012_recomendacoes.sql`
- Create: `supabase/tests/recomendacoes.test.sql`

- [ ] **Step 1.1: Criar branch de feature**

```bash
rtk git checkout -b feat/cart-recommendations
rtk git status
```

Expected: branch criada, working tree limpa.

- [ ] **Step 1.2: Criar a migration**

Crie `supabase/migrations/0012_recomendacoes.sql` com o conteúdo abaixo. **NÃO mude a assinatura ou os pesos sem consultar o spec** — eles foram fixados após review de segunda iteração (categoria/marca binários, complementares acumulam).

```sql
-- Função de recomendação para carrinho.
-- Cascata: complementares (+10, acumula) → categoria (+3, binário) → marca (+1, binário).
-- Filtros aplicados no SELECT final: ativo=true, produto_pai_id IS NULL, estoque>0,
-- e exclusão dos próprios itens do carrinho.

create or replace function public.recomendar_para_carrinho(
  cart_ids uuid[],
  limite int default 3
)
returns table (
  id uuid, codigo text, slug text, nome text, descricao text,
  marca_id uuid, categoria_id uuid, preco numeric, preco_promocional numeric,
  estoque int, peso_kg numeric, imagens text[], complementares uuid[],
  ativo boolean, destaque boolean, produto_pai_id uuid, variante_label text,
  marca jsonb, score int
)
language sql
stable
security invoker
set search_path = public
as $$
  with carrinho as (
    select p.id, p.categoria_id, p.marca_id, p.complementares
    from produtos p
    where p.id = any(cart_ids)
  ),
  -- Nível 1: complementares acumulam (uma linha por item-do-cart que referencia o candidato)
  complementares_score as (
    select unnest(c.complementares) as cand_id, 10 as peso
    from carrinho c
  ),
  -- Nível 2: categoria binária (DISTINCT cand_id → 1 linha por candidato)
  categoria_score as (
    select distinct p.id as cand_id, 3 as peso
    from produtos p
    where p.categoria_id in (select categoria_id from carrinho where categoria_id is not null)
  ),
  -- Nível 3: marca binária
  marca_score as (
    select distinct p.id as cand_id, 1 as peso
    from produtos p
    where p.marca_id in (select marca_id from carrinho where marca_id is not null)
  ),
  candidatos as (
    select cand_id, peso from complementares_score
    union all
    select cand_id, peso from categoria_score
    union all
    select cand_id, peso from marca_score
  ),
  scored as (
    select cand_id, sum(peso)::int as score
    from candidatos
    where cand_id is not null
      and cand_id <> all(cart_ids)
    group by cand_id
  )
  select
    p.id, p.codigo, p.slug, p.nome, p.descricao,
    p.marca_id, p.categoria_id, p.preco, p.preco_promocional,
    p.estoque, p.peso_kg, p.imagens, p.complementares,
    p.ativo, p.destaque, p.produto_pai_id, p.variante_label,
    case when m.id is null then null
         else jsonb_build_object('id', m.id, 'nome', m.nome, 'slug', m.slug)
    end as marca,
    s.score
  from scored s
  join produtos p on p.id = s.cand_id
  left join marcas m on m.id = p.marca_id
  where p.ativo
    and p.produto_pai_id is null
    and p.estoque > 0
  order by
    s.score desc,
    (p.preco_promocional is not null) desc,
    p.estoque desc,
    p.nome asc
  limit greatest(1, least(coalesce(limite, 3), 12));
$$;

grant execute on function public.recomendar_para_carrinho(uuid[], int) to anon, authenticated;
```

- [ ] **Step 1.3: Escrever o smoke test SQL**

Crie `supabase/tests/recomendacoes.test.sql` com 3 cenários. Esses testes são lidos manualmente (não há framework de teste SQL no projeto) — rode-os no SQL Editor do Supabase e confira os asserts.

```sql
-- Smoke tests para recomendar_para_carrinho.
-- Como rodar: abra o SQL Editor do Supabase (projeto yfvmjxrtygojnlnkxtmu)
-- e execute bloco por bloco. Cada bloco imprime um resultado que deve casar
-- com o comentário "esperado".

-- Cenário 1: shape do retorno tem `marca` como jsonb com {id, nome, slug}
-- Esperado: 1 linha com marca = {"id": "...", "nome": "...", "slug": "..."} OU null
select id, nome, marca, score
from public.recomendar_para_carrinho(
  array(select id from public.produtos where ativo and produto_pai_id is null limit 1)::uuid[],
  3
);

-- Cenário 2: produto do próprio cart nunca aparece nos resultados
-- Esperado: 0 linhas
with cart as (
  select array(select id from public.produtos where ativo and produto_pai_id is null limit 3) as ids
)
select r.id
from cart, public.recomendar_para_carrinho(cart.ids, 12) r
where r.id = any(cart.ids);

-- Cenário 3: limit clampa em [1,12]
-- Esperado: count <= 12 mesmo passando limit=999
select count(*) as total_clampado
from public.recomendar_para_carrinho(
  array(select id from public.produtos where ativo and produto_pai_id is null limit 2)::uuid[],
  999
);

-- Cenário 4: score de complementares acumula, categoria/marca não
-- (executar manualmente com 2 produtos cujo "complementares" inclua o mesmo terceiro produto)
-- Esperado: aquele terceiro produto tem score >= 20 (10+10), maior que outros candidatos
-- de mesma categoria sozinha (que dariam só +3)
-- [Comentado pra rodar sob demanda quando houver dados de teste]
-- select id, nome, score from public.recomendar_para_carrinho(array['<uuid1>','<uuid2>']::uuid[], 5);
```

- [ ] **Step 1.4: Aplicar a migration no Supabase remoto**

```bash
rtk supabase db push
```

Expected: output confirma "Applied migration 0012_recomendacoes.sql". Se pedir senha do projeto, é a senha do Postgres do Supabase (não a senha de conta).

**Observação:** Se preferir aplicar manualmente, abra o SQL Editor do projeto `yfvmjxrtygojnlnkxtmu` no painel Supabase, cole o conteúdo do arquivo e rode. O efeito é idêntico (a migration é idempotente — `create or replace`).

- [ ] **Step 1.5: Validar a função existe e responde**

No SQL Editor do Supabase, rode o cenário 1 do test file. Deve retornar 1 linha com colunas no shape declarado e `marca` como objeto JSON (não texto).

Se a função não existir (`function does not exist`), `db push` falhou — revise output do step 1.4.

- [ ] **Step 1.6: Commit**

```bash
rtk git add supabase/migrations/0012_recomendacoes.sql supabase/tests/recomendacoes.test.sql
rtk git commit -m "feat(db): add recomendar_para_carrinho RPC com cascata complementares/categoria/marca"
```

---

## Task 2: Endpoint FastAPI

**Files:**
- Modify: `api/routers/produtos.py:7-91` (adicionar endpoint **antes** da rota `/{slug}`)

- [ ] **Step 2.1: Importar `Response` do FastAPI**

No topo de `api/routers/produtos.py`, altere o import:

De:
```python
from fastapi import APIRouter, HTTPException, Query
```

Para:
```python
from fastapi import APIRouter, HTTPException, Query, Response
```

- [ ] **Step 2.2: Adicionar o endpoint**

**IMPORTANTE — ordem das rotas:** o endpoint novo precisa vir **antes** de `@router.get("/{slug}")` (linha 62 do arquivo atual). FastAPI casa rotas na ordem de declaração; se `/{slug}` vier primeiro, qualquer requisição a `/produtos/recomendacoes` será capturada como slug="recomendacoes" e retornará 404.

Adicione o bloco abaixo entre `list_produtos` (termina ~linha 59) e `get_produto` (começa linha 62):

```python
import re

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)


@router.get("/recomendacoes")
async def recomendacoes_carrinho(
    response: Response,
    ids: str = Query(..., description="UUIDs de produtos no carrinho, separados por vírgula"),
    limit: int = Query(default=3, ge=1, le=12),
):
    response.headers["Cache-Control"] = "private, max-age=60"
    cart_ids = [s.strip() for s in ids.split(",") if _UUID_RE.match(s.strip())]
    if not cart_ids:
        return {"items": []}
    sb = get_supabase()
    resp = sb.rpc(
        "recomendar_para_carrinho",
        {"cart_ids": cart_ids, "limite": limit},
    ).execute()
    return {"items": resp.data or []}
```

**Por que filtrar com regex UUID:** `supabase-py` repassa os strings pro Postgres, que dá `invalid input syntax for type uuid` quando recebe lixo — isso vira 500 com `Cache-Control` já no header. Filtrar antes torna o endpoint determinístico: IDs inválidos simplesmente não contam, sem erro 500 visível.

**Por que `/recomendacoes` e não `/produtos/recomendacoes`:** o router já tem `prefix="/api/produtos"` (linha 7), então o decorator `@router.get("/recomendacoes")` resolve pra `/api/produtos/recomendacoes`.

- [ ] **Step 2.3: Reiniciar uvicorn (pra carregar o novo endpoint)**

O uvicorn está rodando com `--reload`, então salvar o arquivo já recarrega — espere 1-2s e siga. Só force restart se o reload travar (raro, mas acontece se houver erro de sintaxe no Python):

```bash
# $PID é variável automática no PowerShell — usar outro nome
UVICORN_PID=$(rtk netstat -ano | grep -E ":8000\s.*LISTENING" | awk '{print $NF}' | head -1)
rtk powershell -Command "Stop-Process -Id $UVICORN_PID -Force"
.venv/Scripts/python.exe -m uvicorn api.index:app --reload --port 8000 &
```

- [ ] **Step 2.4: Smoke test do endpoint**

```bash
# Pegar 2 IDs de produtos ativos do banco pra usar como cart fake
IDS=$(rtk curl -s "http://localhost:3000/api/produtos?page=1" | python -c "import sys,json; d=json.load(sys.stdin); print(','.join(p['id'] for p in d['items'][:2]))")
echo "IDs: $IDS"

# Chamar o endpoint via proxy do Next
rtk curl -s -i "http://localhost:3000/api/produtos/recomendacoes?ids=$IDS&limit=3" | head -20
```

Expected:
- HTTP 200
- Header `cache-control: private, max-age=60`
- Body JSON com chave `items` contendo até 3 produtos
- Cada item tem campo `marca` como objeto `{id, nome, slug}` (ou null), **não** como string

- [ ] **Step 2.5: Smoke test edge cases**

```bash
# ids vazio → items vazio, sem erro
rtk curl -s "http://localhost:3000/api/produtos/recomendacoes?ids=&limit=3"

# limit fora do range → erro 422 (Pydantic Query validation, esperado)
rtk curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:3000/api/produtos/recomendacoes?ids=$IDS&limit=999"

# UUID inválido (caractere errado) → não dá erro 500, RPC ignora
rtk curl -s "http://localhost:3000/api/produtos/recomendacoes?ids=not-a-uuid&limit=3"
```

Expected:
- `ids vazio` → `{"items":[]}`
- `limit=999` → HTTP 422
- `not-a-uuid` → ou retorna `{"items":[]}` ou erro tratado (não pode ser 500 quebrando o servidor)

Se o caso `not-a-uuid` derrubar o uvicorn com erro de cast pra UUID, adicione validação simples (regex UUID) antes do `rpc` — mas só se acontecer.

- [ ] **Step 2.6: Commit**

```bash
rtk git add api/routers/produtos.py
rtk git commit -m "feat(api): endpoint /api/produtos/recomendacoes chamando RPC"
```

---

## Task 3: Componente CartRecommendations

**Files:**
- Create: `components/carrinho/CartRecommendations.tsx`

- [ ] **Step 3.1: Criar o componente**

Crie `components/carrinho/CartRecommendations.tsx` com o conteúdo abaixo. O arquivo é Client Component (cart é client-side persistido em localStorage).

```tsx
"use client";

import { useEffect, useState } from "react";

import { ProductCard } from "@/components/catalog/ProductCard";
import { useCart } from "@/lib/cart-store";
import type { ProdutoComMarca } from "@/types";

const DEBOUNCE_MS = 300;
const LIMIT = 3;

export function CartRecommendations() {
  const itens = useCart((s) => s.itens);
  const [recomendacoes, setRecomendacoes] = useState<ProdutoComMarca[]>([]);
  const [loading, setLoading] = useState(false);

  const idsKey = [...itens.map((i) => i.produto_id)].sort().join(",");

  useEffect(() => {
    if (!idsKey) {
      setRecomendacoes([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      fetch(`/api/produtos/recomendacoes?ids=${idsKey}&limit=${LIMIT}`, {
        signal: controller.signal,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data: { items: ProdutoComMarca[] }) => {
          setRecomendacoes(data.items ?? []);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          console.error("CartRecommendations fetch error:", err);
          setRecomendacoes([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [idsKey]);

  // Cart vazio: não renderiza nada
  if (itens.length === 0) return null;
  // Após fetch sem resultados: não renderiza nada
  if (!loading && recomendacoes.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1280px] px-6 py-8">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-mono text-ink-2">
        PODE TE INTERESSAR
      </div>
      <h2 className="mb-6 font-display text-[22px] tracking-tight text-ink md:text-[26px]">
        Produtos que combinam com sua cesta
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {loading
          ? Array.from({ length: LIMIT }).map((_, i) => <SkeletonCard key={i} />)
          : recomendacoes.map((p) => <ProductCard key={p.id} produto={p} />)}
      </div>
    </section>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col border border-line bg-white">
      <div className="aspect-square animate-pulse bg-bone" />
      <div className="space-y-2 p-4">
        <div className="h-2 w-16 animate-pulse bg-bone" />
        <div className="h-4 w-full animate-pulse bg-bone" />
        <div className="h-4 w-3/4 animate-pulse bg-bone" />
        <div className="h-6 w-24 animate-pulse bg-bone" />
        <div className="h-9 w-full animate-pulse bg-bone" />
      </div>
    </div>
  );
}
```

**Notas de design ancoradas:**
- `useCart((s) => s.itens)` é selector — só re-renderiza quando `itens` muda (não quando outros campos do store mudam). Quantidade muda dentro de `itens[i].quantidade`, mas como deriva o `idsKey` por `produto_id` ordenado, a string só muda quando IDs entram/saem. O useEffect só dispara quando `idsKey` muda — quantidade não causa refetch.
- `Array.from({ length: 3 })` pro skeleton mantém altura previsível (evita CLS).
- Classes `border-line`, `bg-bone`, `text-ink-2`, `font-display`, `font-mono` já existem no `tailwind.config.ts` — não inventar utilitários.

- [ ] **Step 3.2: Verificar typecheck**

```bash
rtk npx tsc --noEmit
```

Expected: zero erros novos. Se aparecer erro em `CartRecommendations.tsx`, é provavelmente import path errado ou tipo incompatível — corrigir antes de continuar.

- [ ] **Step 3.3: Commit**

```bash
rtk git add components/carrinho/CartRecommendations.tsx
rtk git commit -m "feat(carrinho): componente CartRecommendations (fetch + render via ProductCard)"
```

---

## Task 4: Integração na página /carrinho

**Files:**
- Modify: `app/(public)/carrinho/page.tsx:9` (import) e `:40` (insert)

- [ ] **Step 4.1: Adicionar import**

Em `app/(public)/carrinho/page.tsx`, adicione um import abaixo do import de `FreteEstimativa` (linha 9):

```tsx
import { CartRecommendations } from "@/components/carrinho/CartRecommendations";
```

- [ ] **Step 4.2: Inserir o componente fora do ternário**

A página tem essa estrutura simplificada:

```tsx
<div className="bg-bone">
  <div className="border-b border-line bg-white"> {/* Header */}
    ...
  </div>
  <div className="mx-auto max-w-[1280px] px-6 py-8">  {/* linha 41 */}
    {itens.length === 0 ? (
      <div>CESTA VAZIA</div>
    ) : (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">...</div>
    )}
  </div>
</div>
```

`<CartRecommendations />` vai **entre** o fechamento do Header (linha 39, `</div>` que fecha `<div className="border-b border-line bg-white">`) e a abertura do `<div className="mx-auto max-w-[1280px] px-6 py-8">` (linha 41).

Use o `Edit` tool com este `old_string` (presente no arquivo) e `new_string`:

`old_string`:
```tsx
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 py-8">
        {itens.length === 0 ? (
```

`new_string`:
```tsx
        </div>
      </div>

      <CartRecommendations />

      <div className="mx-auto max-w-[1280px] px-6 py-8">
        {itens.length === 0 ? (
```

O componente tem o próprio wrapper `mx-auto max-w-[1280px] px-6 py-8`, então o alinhamento horizontal bate com o header e a lista.

- [ ] **Step 4.3: Validar visualmente — cart vazio**

Garanta dev servers rodando (`npm run dev` em :3000 e uvicorn em :8000).

Abra http://localhost:3000/carrinho em uma janela anônima (ou limpe localStorage `natalmaq-cart-v1`).

Expected:
- Header "Sua Cesta de Orçamento" aparece.
- Logo abaixo, **nenhum** bloco "Pode te interessar" (componente retorna null em cart vazio).
- Estado "CESTA VAZIA" aparece normalmente.

Se aparecer um espaço em branco onde deveria não ter nada, o componente está renderizando o wrapper com `null` filho — verifique se o `if (itens.length === 0) return null` está **antes** do JSX.

- [ ] **Step 4.4: Validar visualmente — cart com 1+ item**

Vá pra http://localhost:3000/catalogo, clique em "+ Orçamento" de 2-3 produtos diferentes. Depois abra `/carrinho`.

Expected:
- Header.
- Bloco "PODE TE INTERESSAR / Produtos que combinam com sua cesta" com 3 skeletons cinza brevemente, depois 3 cards reais (ou menos se a cascata não cobriu 3).
- Abaixo, a lista de itens + sidebar do resumo (intacta).
- Nenhum dos cards recomendados é um item que já está no carrinho.

Se aparecer só skeleton e não progride, abra DevTools → Network e veja se a request `/api/produtos/recomendacoes` está 200. Se 500, ler logs do uvicorn.

- [ ] **Step 4.5: Validar comportamento — debounce e auto-update**

Com carrinho com 2 itens, abra DevTools → Network → filter "recomendacoes".

- Adicione outro item via "+ Orçamento" num card recomendado.
- Confira: depois de ~300ms, uma nova request `/api/produtos/recomendacoes?ids=...` dispara com a lista atualizada de IDs.
- O item que foi adicionado **não** aparece mais nas recomendações (a request envia ele entre os IDs do cart, e a RPC filtra ele fora).

- Aperte `+` no spinner de quantidade rapidamente 5x.
- Confira: **nenhuma** nova request dispara (quantidade não muda IDs).

- [ ] **Step 4.6: Validar comportamento — falha de rede não quebra a página**

Em DevTools → Network, ative "Offline" (ou pause uvicorn com Ctrl+C).

- Recarregue `/carrinho` com itens.
- Expected: skeleton aparece brevemente, depois desaparece (componente retorna null em erro). A página continua interativa, o resumo da proposta e o botão "Continuar pedido" funcionam.
- Console deve mostrar `CartRecommendations fetch error: ...` (esperado).

Religue uvicorn / network e recarregue — recomendações voltam.

- [ ] **Step 4.7: Commit**

```bash
rtk git add app/(public)/carrinho/page.tsx
rtk git commit -m "feat(carrinho): renderiza CartRecommendations entre header e lista"
```

---

## Task 5: Aceitação final

- [ ] **Step 5.1: Rodar typecheck e build**

```bash
rtk npx tsc --noEmit
rtk npm run build
```

Expected: zero erros TS, build completa com sucesso. Se build falhar em `CartRecommendations` por ser usado em página com `"use client"` raiz, está tudo certo — verifique mensagem específica.

- [ ] **Step 5.2: Conferir os 7 critérios de aceitação do spec**

Marcar manualmente:

- [ ] Carrinho com 1+ itens mostra seção "Pode te interessar" com até 3 cards.
- [ ] Carrinho vazio não mostra a seção (nenhum espaço em branco residual).
- [ ] Adicionar/remover item no cart atualiza as recomendações com ~300ms de debounce.
- [ ] Recomendações nunca incluem produto já no cart.
- [ ] Recomendações respeitam `ativo=true` e `produto_pai_id IS NULL` (validar via dados — produtos inativos não aparecem).
- [ ] Falha de rede/API não quebra a página do carrinho (com uvicorn off, página continua usável).
- [ ] Clique em card vai para `/produto/[slug]`. Botão "+ Orçamento" adiciona ao carrinho e refaz fetch.

- [ ] **Step 5.3: Mergear no master (decisão do usuário, não automático)**

```bash
rtk git log --oneline master..feat/cart-recommendations
# 4 commits esperados: migration, endpoint, componente, integração
```

Não fazer merge automático. Pergunte ao usuário se quer:

1. Abrir PR via `gh pr create`
2. Fast-forward direto pro master (`git checkout master && git merge feat/cart-recommendations`)
3. Manter na branch pra continuar trabalhando

---

## Edge cases tratados (lembrete)

| Situação | Onde tratado |
|---|---|
| Cart vazio | Componente retorna `null` ANTES do useEffect rodar |
| Fetch em andamento | Skeletons de altura fixa (sem CLS) |
| Fetch retornou 0 produtos | Componente retorna `null` (silently hide) |
| Fetch retornou 1-2 (não 3) | Renderiza só os disponíveis, sem placeholder |
| Erro de rede / 5xx | `console.error` + retorna `null` |
| Quantidade muda no spinner | Não re-dispara fetch (dep é `idsKey` ordenada) |
| IDs duplicados na query | RPC dedupe via `group by cand_id` |
| UUID inválido na query | RPC ignora (filtro `p.id = any(cart_ids)`) |
| `limit` fora de [1,12] | API rejeita com 422 (FastAPI `Query(ge=1, le=12)`); RPC re-clampa por defesa |
| Produto-pai (variante filha) candidato | Filtro `produto_pai_id IS NULL` no SELECT final |
| Produto esgotado | Filtro `estoque > 0` no SELECT final |
| Race condition (cart muda durante fetch) | `AbortController` cancela request em vôo |

## Notas de operação

- **Migration em produção**: o `supabase db push` aplica direto no Supabase remoto (não temos local funcionando — ECR rate-limit). É idempotente (`create or replace`), reverter é `drop function public.recomendar_para_carrinho(uuid[], int);`.
- **Cache HTTP**: `Cache-Control: private, max-age=60` é por sessão (private). Se quiser invalidação imediata, mudar pra `no-store` no endpoint.
- **Tracking futuro**: quando for instrumentar clique nas recomendações, criar endpoint `POST /api/eventos/recomendacao_clique` separado — não embutir no GET de recomendações (mantém o GET cachable e idempotente).
- **Tabela vazia de pedidos**: quando houver volume (>500 pedidos), considerar substituir a cascata por "compraram juntos" via CTE em `pedido_itens` — schema já suporta, vide spec.
