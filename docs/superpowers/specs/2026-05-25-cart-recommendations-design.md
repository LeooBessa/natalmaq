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

| Origem do match | Peso |
|---|---|
| Aparece em `complementares[]` de um item do carrinho | +10 |
| Compartilha `categoria_id` com um item do carrinho | +3 |
| Compartilha `marca_id` com um item do carrinho | +1 |

O score acumula. Um candidato que é complementar de 2 itens e da mesma marca de 1 outro ganha `10+10+1=21`.

Ordenação: `score DESC`, desempate por `preco_promocional IS NOT NULL DESC`, `estoque DESC`, `nome ASC` (estabilidade).

Top 3 são retornados.

### Filtros (aplicados em todos os níveis)

- `ativo = true`
- `produto_pai_id IS NULL` (só pais, igual catálogo público)
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
  marca_nome text, score int
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
  complementares as (
    select unnest(c.complementares) as cand_id, 10 as peso
    from carrinho c
  ),
  por_categoria as (
    select p.id as cand_id, 3 as peso
    from produtos p
    join carrinho c on p.categoria_id = c.categoria_id
    where p.ativo and p.produto_pai_id is null
  ),
  por_marca as (
    select p.id as cand_id, 1 as peso
    from produtos p
    join carrinho c on p.marca_id = c.marca_id
    where p.ativo and p.produto_pai_id is null
  ),
  candidatos as (
    select cand_id, peso from complementares
    union all
    select cand_id, peso from por_categoria
    union all
    select cand_id, peso from por_marca
  ),
  scored as (
    select cand_id, sum(peso) as score
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
    m.nome as marca_nome,
    s.score::int
  from scored s
  join produtos p on p.id = s.cand_id
  left join marcas m on m.id = p.marca_id
  where p.ativo
    and p.produto_pai_id is null
  order by
    s.score desc,
    (p.preco_promocional is not null) desc,
    p.estoque desc,
    p.nome asc
  limit greatest(1, least(coalesce(limite, 3), 12));
$$;

grant execute on function public.recomendar_para_carrinho(uuid[], int) to anon, authenticated;
```

**Endpoint novo** — `api/routers/produtos.py`:

```python
@router.get("/produtos/recomendacoes")
async def recomendacoes_carrinho(
    ids: str = Query(..., description="UUIDs separados por vírgula"),
    limit: int = Query(3, ge=1, le=12),
):
    cart_ids = [s.strip() for s in ids.split(",") if s.strip()]
    if not cart_ids:
        return {"items": []}
    sb = get_supabase()
    resp = sb.rpc("recomendar_para_carrinho", {
        "cart_ids": cart_ids,
        "limite": limit,
    }).execute()
    return {"items": resp.data or []}
```

Headers de resposta: `Cache-Control: private, max-age=60` (carrinhos mudam rápido; 60s evita refetch em re-renders).

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

Adicionar `<CartRecommendations />` entre o bloco do header (linhas 17-39 do estado atual) e o bloco com lista + sidebar.

### Reuso do ProductCard

`components/catalog/ProductCard.tsx` é usado sem adaptação. Props esperadas: `{ produto: ProdutoComMarca }`. O shape retornado pela RPC casa com esse type (campos `marca_nome` + todos os campos de `produtos`).

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

## Critério de aceitação

1. Carrinho com 1+ itens mostra seção "Pode te interessar" com até 3 cards.
2. Carrinho vazio não mostra a seção.
3. Adicionar/remover item no cart atualiza as recomendações (com debounce ~300ms).
4. Recomendações nunca incluem produto já no cart.
5. Recomendações respeitam `ativo=true` e `produto_pai_id IS NULL`.
6. Falha de rede/API não quebra a página do carrinho.
7. Clique em card vai para `/produto/[slug]`. Botão "+ Orçamento" adiciona ao carrinho.
