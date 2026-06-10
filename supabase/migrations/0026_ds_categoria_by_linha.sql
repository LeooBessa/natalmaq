-- ============================================================================
-- 0022 — Categorização determinística por codigo_linha dentro do RPC
--
-- Motivo: o mapeamento codigo_linha→categoria feito no Python (cat_map) teve
-- cobertura inconsistente em alguns syncs (produtos com linha mapeável ficavam
-- sem categoria). Agora o próprio RPC deriva categoria_id do codigo_linha em
-- SQL — sempre correto, independente do que o Python enviar.
-- ============================================================================

-- mapa codigo_linha -> slug da categoria (espelha api/core/ds_categorias.py)
create or replace function public.ds_slug_de_linha(linha text)
returns text
language sql
immutable
as $fn$
  select case ltrim(coalesce(linha, ''), '0')
    when '1'  then 'transmissao'
    when '2'  then 'abrasivos'
    when '3'  then 'ferramentas'
    when '5'  then 'maquinas'
    when '6'  then 'oxicorte'
    when '7'  then 'seguranca'
    when '8'  then 'solda-arame'
    when '10' then 'pecas'
    when '12' then 'quimicos'
    when '14' then 'ferragens'
    when '15' then 'fixacao'
    when '16' then 'eletrica'
    when '18' then 'seguranca'
    when '19' then 'adesivos'
    when '20' then 'solda-elet'
    else null
  end;
$fn$;

create or replace function public.ds_upsert_produtos(rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $func$
declare
  n int;
begin
  insert into produtos as p (
    codigo, slug, nome, preco, preco_promocional, preco_custo,
    ativo, categoria_id, codigo_linha, unidade, referencia, codigo_barra,
    ds_updated_at, synced_at
  )
  select
    r.codigo,
    coalesce(nullif(r.slug, ''), 'produto-' || r.codigo),
    r.nome,
    coalesce(r.preco, 0),
    r.preco_promocional,
    r.preco_custo,
    coalesce(r.ativo, true),
    (select c.id from categorias c where c.slug = public.ds_slug_de_linha(r.codigo_linha)),
    r.codigo_linha,
    r.unidade,
    r.referencia,
    r.codigo_barra,
    r.ds_updated_at,
    r.synced_at
  from jsonb_to_recordset(rows) as r(
    codigo            text,
    slug              text,
    nome              text,
    preco             numeric,
    preco_promocional numeric,
    preco_custo       numeric,
    ativo             boolean,
    categoria_id      uuid,
    codigo_linha      text,
    unidade           text,
    referencia        text,
    codigo_barra      text,
    ds_updated_at     timestamptz,
    synced_at         timestamptz
  )
  on conflict (codigo) do update set
    nome              = excluded.nome,
    preco             = excluded.preco,
    preco_promocional = excluded.preco_promocional,
    preco_custo       = excluded.preco_custo,
    ativo             = excluded.ativo,
    categoria_id      = coalesce(
      (select c.id from categorias c where c.slug = public.ds_slug_de_linha(excluded.codigo_linha)),
      p.categoria_id
    ),
    codigo_linha      = excluded.codigo_linha,
    unidade           = excluded.unidade,
    referencia        = excluded.referencia,
    codigo_barra      = excluded.codigo_barra,
    ds_updated_at     = excluded.ds_updated_at,
    synced_at         = excluded.synced_at;
  get diagnostics n = row_count;
  return n;
end;
$func$;
