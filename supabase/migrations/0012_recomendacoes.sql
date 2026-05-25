-- Função de recomendação para carrinho.
-- Cascata: complementares (+10, acumula) → categoria (+3, binário) → marca (+1, binário).
-- Filtros aplicados no SELECT final: ativo=true, produto_pai_id IS NULL, estoque>0,
-- e exclusão dos próprios itens do carrinho.
--
-- Rollback: DROP FUNCTION public.recomendar_para_carrinho(uuid[], int);

create or replace function public.recomendar_para_carrinho(
  cart_ids uuid[],
  limite int default 3
)
returns table (
  id uuid, codigo text, slug text, nome text, descricao text,
  marca_id uuid, categoria_id uuid, preco numeric, preco_promocional numeric,
  estoque int, peso_kg numeric, imagens jsonb, complementares uuid[],
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
