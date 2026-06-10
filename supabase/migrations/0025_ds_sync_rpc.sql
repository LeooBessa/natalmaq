-- ============================================================================
-- 0021 — Funções RPC para o sync DS (upsert atômico preservando fotos)
--
-- ds_upsert_produtos(rows): insere produtos novos (com slug gerado) e atualiza
--   os existentes APENAS nas características vindas do DS. NUNCA toca em
--   slug, imagens, destaque, complementares, descricao, peso_kg.
-- ds_update_estoque(rows): atualiza só `estoque` dos produtos JÁ existentes
--   (UPDATE puro — não insere nada).
-- ============================================================================

create or replace function public.ds_upsert_produtos(rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
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
    r.categoria_id,
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
    categoria_id      = coalesce(excluded.categoria_id, p.categoria_id),
    codigo_linha      = excluded.codigo_linha,
    unidade           = excluded.unidade,
    referencia        = excluded.referencia,
    codigo_barra      = excluded.codigo_barra,
    ds_updated_at     = excluded.ds_updated_at,
    synced_at         = excluded.synced_at;
    -- PRESERVADOS (não aparecem no SET): slug, imagens, destaque,
    -- complementares, descricao, peso_kg, marca_id.
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.ds_update_estoque(rows jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update produtos p
     set estoque = r.estoque,
         synced_at = r.synced_at
  from jsonb_to_recordset(rows) as r(
    codigo    text,
    estoque   int,
    synced_at timestamptz
  )
  where p.codigo = r.codigo;
  get diagnostics n = row_count;
  return n;
end;
$$;
