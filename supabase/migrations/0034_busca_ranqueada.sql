-- ============================================================================
-- 0034 — Busca ranqueada (dropdown + resultados do catálogo)
--
-- Problema: a busca de resultados usava ILIKE no nome, então "parafuso allen"
-- não achava "PARAF ALLEN" (abreviação) e não tinha noção de relevância — os
-- "parafuso allen s/c" apareciam misturados com os "parafuso allen".
--
-- Esta função casa via busca_tsv (nome peso A + descrição peso B, sem acento) —
-- uma tsquery de PREFIXO (word:* & word:*) que também funciona enquanto digita.
-- A ORDEM prioriza os itens "base" antes das variantes: o sinal decisivo é o
-- NÚMERO DE PALAVRAS do nome (a variante acrescenta palavras — S/C, INOX,
-- C/CHATA…), então menos palavras = base = topo. Desempate: nome começa com o
-- termo (typeahead) > menos palavras (base) > em estoque > com foto > alfabética.
-- ============================================================================

create or replace function public.buscar_produtos_rank(
  termo          text,
  p_marca_id     uuid    default null,
  p_categoria_id uuid    default null,
  so_promocao    boolean default false,
  so_estoque     boolean default false,
  lim            int     default 24,
  off            int     default 0
)
returns table (
  id uuid, codigo text, slug text, nome text, descricao text,
  marca_id uuid, categoria_id uuid, preco numeric, preco_promocional numeric,
  estoque int, peso_kg numeric, imagens jsonb, complementares uuid[],
  ativo boolean, destaque boolean, produto_pai_id uuid, variante_label text,
  marca jsonb, categoria jsonb, total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with cfg as (
    select
      public.immutable_unaccent(lower(coalesce(termo, ''))) as termo_norm,
      nullif(
        array_to_string(
          array(
            select w || ':*'
            from unnest(
              regexp_split_to_array(
                public.immutable_unaccent(lower(coalesce(termo, ''))),
                '[^a-z0-9]+'
              )
            ) as w
            where w <> ''
          ),
          ' & '
        ),
        ''
      ) as qstr
  ),
  q as (
    select
      c.termo_norm,
      case when c.qstr is null then null
           else to_tsquery('portuguese', c.qstr) end as tsq
    from cfg c
  ),
  base as (
    select p.*
    from produtos p
    cross join q
    where p.ativo
      and p.produto_pai_id is null
      and (p_marca_id is null or p.marca_id = p_marca_id)
      and (p_categoria_id is null or p.categoria_id = p_categoria_id)
      and (not so_promocao or p.preco_promocional is not null)
      and (not so_estoque or p.estoque > 0)
      and (
        (q.tsq is not null and p.busca_tsv @@ q.tsq)
        or public.immutable_unaccent(lower(p.nome)) like '%' || q.termo_norm || '%'
      )
  )
  select
    b.id, b.codigo, b.slug, b.nome, b.descricao,
    b.marca_id, b.categoria_id, b.preco, b.preco_promocional,
    b.estoque, b.peso_kg, b.imagens, b.complementares,
    b.ativo, b.destaque, b.produto_pai_id, b.variante_label,
    case when mrc.id is null then null
         else jsonb_build_object('id', mrc.id, 'nome', mrc.nome, 'slug', mrc.slug) end as marca,
    case when cat.id is null then null
         else jsonb_build_object('id', cat.id, 'nome', cat.nome, 'slug', cat.slug) end as categoria,
    count(*) over() as total_count
  from base b
  cross join q
  left join marcas mrc on mrc.id = b.marca_id
  left join categorias cat on cat.id = b.categoria_id
  order by
    (public.immutable_unaccent(lower(b.nome)) like q.termo_norm || '%') desc, -- nome começa com o termo (typeahead)
    cardinality(                                                              -- base (menos palavras) antes das variantes
      string_to_array(
        btrim(regexp_replace(public.immutable_unaccent(lower(b.nome)), '[^a-z]+', ' ', 'g')),
        ' '
      )
    ) asc,
    b.em_estoque desc,                                                        -- em estoque primeiro
    b.tem_foto desc,                                                          -- com foto primeiro
    b.nome asc                                                                -- alfabética
  limit lim
  offset off
$$;

grant execute on function public.buscar_produtos_rank(text, uuid, uuid, boolean, boolean, int, int)
  to anon, authenticated;
