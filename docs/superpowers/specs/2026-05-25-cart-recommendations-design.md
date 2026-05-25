# Cart Recommendations — Design Spec

**Data:** 2026-05-25
**Status:** Aprovado para implementação
**Branch alvo:** `feat/cart-recommendations` (criar na fase de plano)

## Resumo

Adicionar uma seção "Pode te interessar" na página `/carrinho`, exibindo 3 produtos correlatos ao conteúdo atual do carrinho. Recomendação é calculada server-side a partir do schema existente, sem depender de histórico de pedidos (que está vazio em soft-launch).

## Escopo

**Incluído:**
- Novo endpoint `GET /api/produtos/recomendacoes` no FastAPI.
- Nova função SQL `public.recomendar_para_carrinho(uuid[], int)` (migration 0012).
- Novo componente client `components/carrinho/CartRecommendations.tsx`.
- Edit em `app/(public)/carrinho/page.tsx` para incluir o componente entre header e lista.

**Excluído (fora do MVP, candidatos a iteração futura):**
- Tracking/analytics de clique nas recomendações.
- Recomendação baseada em "compraram juntos" (precisa de histórico real).
- Recomendações em outros contextos (página de produto, drawer pós-add, e-mail pós-checkout).
- A/B test entre estratégias.

## Algoritmo

### Cascata por item

Para cada `produto_id` no carrinho, coleta candidatos em três níveis:

1. **Complementares** — produtos listados em `produtos.complementares[]` (uuid array curado pelo admin).
2. **Mesma categoria** — outros produtos com mesma `categoria_id`. Só usado se nível 1 não cobriu 3.
3. **Mesma marca** — outros produtos com mesma `marca_id`. Só usado se 1+2 não cobriram 3.

### Score e agregação

Quando o carrinho tem N itens, candidatos são deduplicados por `id` e pontuados:

| Origem do match | Peso | Acumula? |
|---|---|---|
| Aparece em `complementares[]` de um item do carrinho | +10 | **Sim** (uma vez por item que o referencia) |
| Compartilha `categoria_id` com pelo menos um item do carrinho | +3 | **Não** (binário) |
| Compartilha `marca_id` com pelo menos um item do carrinho | +1 | **Não** (binário) |

Justificativa do design assimétrico: `complementares[]` é curadoria humana — quanto mais itens do cart referenciam o mesmo produto como complementar, mais forte o sinal, então acumula. Categoria e marca são genéricas — se acumulassem, um carrinho de 5 furadeiras daria +15 baseline a toda furadeira do catálogo, dominando o sinal curado (+10) de um único complementar.

Exemplos:

- Candidato complementar de 2 itens, mesma categoria de algum item, mesma marca de algum item: `10+10+3+1 = 24`.
- Candidato sem complementar match, mas com cart de 5 itens da mesma categoria E mesma marca: `0+3+1 = 4` (não `15+5`).

Ordenação: `score DESC`, desempate por `preco_promocional IS NOT NULL DESC`, `estoque DESC`, `nome ASC` (estabilidade).

Top 3 são retornados.

### Filtros

Aplicados no `SELECT` final (a RPC reúne candidatos primeiro e filtra depois, simplicidade > micro-otimização):

- `ativo = true`
- `produto_pai_id IS NULL` (só pais, igual catálogo público)
- `estoque > 0` (não recomendar esgotado — perde sentido na cesta)
- `id NOT IN (<ids do carrinho>)` — nunca recomendar o que já está no carrinho.

## Arquitetura

### Backend

**Migration nova** — `supabase/migrations/0012_recomendacoes.sql`:

```sql
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
  -- Nível 1: complementares acumulam (uma linha por (item_cart, cand_id))
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
  -- Nível 3: marca binária (DISTINCT cand_id → 1 linha por candidato)
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

**Por que `marca jsonb` e não `marca_nome text`:** `ProductCard` lê `produto.marca?.nome` e `produto.marca?.slug` (type `ProdutoComMarca` em [types/index.ts:35-38](types/index.ts#L35-L38)). RPC retornar `jsonb` deserializa direto pro shape esperado no JSON da resposta, sem mapping extra no Python.

**Endpoint novo** — `api/routers/produtos.py`:

```python
from fastapi import Response

@router.get("/produtos/recomendacoes")
async def recomendacoes_carrinho(
    response: Response,
    ids: str = Query(..., description="UUIDs separados por vírgula"),
    limit: int = Query(3, ge=1, le=12),
):
    cart_ids = [s.strip() for s in ids.split(",") if s.strip()]
    response.headers["Cache-Control"] = "private, max-age=60"
    if not cart_ids:
        return {"items": []}
    sb = get_supabase()
    resp = sb.rpc("recomendar_para_carrinho", {
        "cart_ids": cart_ids,
        "limite": limit,
    }).execute()
    return {"items": resp.data or []}
```

`Cache-Control: private, max-age=60` evita refetch em re-renders dentro da mesma sessão; 60s é curto o bastante pra ajustes de cart serem refletidos rápido. A injeção de `Response` é o padrão FastAPI pra setar headers sem trocar o tipo de retorno.

### Frontend

**Componente novo** — `components/carrinho/CartRecommendations.tsx`:

- Client Component (`"use client"`).
- Lê `itens` de `useCart()` → extrai array de `produto_id`.
- Se `itens.length === 0` → `return null`.
- `useEffect` com dep `[...ids].sort().join(",")`:
  - Aplica debounce de 300ms (timeout limpo no cleanup do effect).
  - `fetch('/api/produtos/recomendacoes?ids=' + ids.join(',') + '&limit=3')`.
  - `AbortController` cancela request em flight quando deps mudam.
- Estados:
  - `loading` → header + 3 skeletons (mesma altura do `ProductCard`).
  - `error` → `console.error` + `return null`.
  - `success` e items vazio → `return null`.
  - `success` com 1-3 items → header + grid dos cards reais.
- Layout: `grid grid-cols-1 md:grid-cols-3 gap-4`. Header em `font-display` com texto "Pode te interessar", padrão tipográfico da página `/carrinho`.

**Edição** — `app/(public)/carrinho/page.tsx`:

A página tem um ternário (`itens.length === 0 ? "estado vazio" : "lista+sidebar"`). `<CartRecommendations />` é colocado **fora** do ternário, no escopo do `<div className="bg-bone">` raiz, logo após o bloco do header (linhas ~17-39 do estado atual) e **antes** do ternário. Como o próprio componente retorna `null` quando o cart está vazio, isso evita lógica duplicada e mantém a posição consistente quando o cart sai/entra do estado vazio.

**Container width:** o componente é responsável pelo próprio wrapper `mx-auto max-w-[1280px] px-6 py-8`, espelhando o padrão da página. Sem isso, a faixa renderiza full-width enquanto header e lista ficam constritos a 1280px — alinhamento horizontal inconsistente.

### Reuso do ProductCard

`components/catalog/ProductCard.tsx` é usado sem adaptação. Props esperadas: `{ produto: ProdutoComMarca }` ([types/index.ts:35-38](types/index.ts#L35-L38)). O shape retornado pela RPC casa porque `marca` vem como `jsonb` com `{ id, nome, slug }`, deserializando direto no objeto aninhado que o card consome.

## Comportamento e edge cases

| Situação | Comportamento |
|---|---|
| Carrinho vazio | Componente retorna `null`. Sem header, sem skeleton. |
| Carrinho com itens, fetch em andamento | Header + 3 skeletons. |
| Fetch retornou 3 produtos | Header + 3 ProductCards. |
| Fetch retornou 1 ou 2 produtos | Header + os cards disponíveis. Não preenche com placeholder. |
| Fetch retornou 0 produtos | Componente retorna `null` (silently hide). |
| Fetch deu erro (rede, 500, timeout) | `console.error`, componente retorna `null`. Não quebra checkout. |
| Mudança de quantidade no spinner | Não re-dispara fetch (dep é lista de IDs, não items completos). |
| IDs duplicados na query | SQL aplica `cand_id IS NOT NULL` + group by — sem efeito de duplicação. |
| ID inválido / não existe | Ignorado silenciosamente pela RPC (filtro `where p.id = any(cart_ids)`). |
| `limit` fora de 1..12 | Clamp via `greatest(1, least(coalesce(limite, 3), 12))`. |
| Carrinho onde só existem esses produtos ativos da categoria | Pode retornar < 3 candidatos — ok, exibe o que houver. |

## Performance

- Uma única RPC por mudança de carrinho (sem N+1).
- Debounce 300ms no client absorve interações rápidas.
- `AbortController` cancela requests em vôo quando o cart muda durante o fetch.
- Cache HTTP `private, max-age=60` no endpoint.
- Skeleton com altura fixa evita CLS.

## Segurança

- RPC `SECURITY INVOKER` — herda o RLS da tabela `produtos` (leitura pública só de `ativo=true`).
- `grant execute` apenas para `anon` e `authenticated`, sem service-role exclusivo.
- Endpoint não exige auth — produtos públicos.
- Não há escrita; sem CSRF/XSRF.

## Testes

- **SQL**: smoke test em `supabase/tests/recomendacoes.test.sql` chamando a RPC com IDs do seed e validando shape do retorno e ordenação por score.
- **Frontend**: 1 teste de render (Vitest + RTL) — só se `vitest`/`@testing-library/react` já estiverem instalados. Se não, pular pra não introduzir dep nova nesta entrega.

## Arquivos tocados (estimativa)

| Arquivo | Tipo | Linhas |
|---|---|---|
| `supabase/migrations/0012_recomendacoes.sql` | NEW | ~70 |
| `api/routers/produtos.py` | EDIT | +~25 |
| `components/carrinho/CartRecommendations.tsx` | NEW | ~80 |
| `app/(public)/carrinho/page.tsx` | EDIT | +2 |
| `supabase/tests/recomendacoes.test.sql` | NEW (opcional) | ~30 |

## Decisões registradas

- **Cascata vs SQL ML**: cascata determinística por simplicidade e auditabilidade. Re-avaliar quando houver volume de pedidos (>500) — aí passa a valer "compraram juntos".
- **RPC vs SQL inline no Python**: RPC. Permite testar via SQL Editor e centraliza a lógica num lugar versionado.
- **Sem TanStack Query**: projeto não usa; introduzir uma dep pra uma chamada não compensa.
- **Posicionamento entre header e lista**: escolha explícita do usuário (visibilidade alta antes da revisão da cesta).
- **Sem tracking no MVP**: instrumentar depois com endpoint separado.
- **Score binário em categoria/marca, acumulado em complementares**: protege contra inflação por carrinhos homogêneos (5 itens da mesma categoria não devem dominar o sinal curado pelo admin).
- **`marca` como `jsonb` na RPC**: deserializa direto no shape `ProdutoComMarca` que o `ProductCard` consome, sem mapping extra no Python.
- **`estoque > 0` no filtro final**: recomendar produto esgotado degrada UX (botão "+ Orçamento" fica desabilitado no card, parece bug).

## Critério de aceitação

1. Carrinho com 1+ itens mostra seção "Pode te interessar" com até 3 cards.
2. Carrinho vazio não mostra a seção.
3. Adicionar/remover item no cart atualiza as recomendações (com debounce ~300ms).
4. Recomendações nunca incluem produto já no cart.
5. Recomendações respeitam `ativo=true` e `produto_pai_id IS NULL`.
6. Falha de rede/API não quebra a página do carrinho.
7. Clique em card vai para `/produto/[slug]`. Botão "+ Orçamento" adiciona ao carrinho.
