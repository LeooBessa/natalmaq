-- ============================================================================
-- 0023 — Soft-delete de produtos removidos do DS (com histórico + revive)
--
-- Quando um produto some do DS, ele NÃO é apagado: vira ativo=false +
-- ds_removido_em=now(). Fica no banco (histórico, com fotos), acessível e
-- revivível. Se voltar ao DS, o próximo sync o "revive" (limpa ds_removido_em).
-- A detecção roda só no fim de um sync FULL, com trava de segurança (cap).
-- ============================================================================

alter table produtos add column if not exists ds_removido_em timestamptz;
create index if not exists idx_produtos_ds_removido on produtos(ds_removido_em)
  where ds_removido_em is not null;

-- RPC de upsert: idêntico ao 0022, porém limpa ds_removido_em ao tocar o
-- produto (revive automático quando ele reaparece no DS).
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
    synced_at         = excluded.synced_at,
    ds_removido_em    = null;  -- reapareceu no DS -> revive
  get diagnostics n = row_count;
  return n;
end;
$func$;

-- Detecta produtos DS (codigo numérico) NÃO tocados por NENHUM sync há mais de
-- `dias` dias => sumiram do DS => soft-delete. Limiar de tempo (não "pass único")
-- porque a paginação do DS é instável e um full sozinho não cobre 100%; mas ao
-- longo de vários dias (fulls diários + incrementais) todo produto presente é
-- tocado. Trava: se passar de `cap`, não mexe e retorna negativo.
-- O param full_started é ignorado (mantido p/ compatibilidade de assinatura).
create or replace function public.ds_finalize_removals(full_started timestamptz, cap int default 800)
returns int
language plpgsql
security definer
set search_path = public
as $fr$
declare
  alvo int;
  n int;
  corte timestamptz := now() - interval '3 days';  -- não tocado há 3 dias = removido
begin
  select count(*) into alvo
    from produtos
   where ativo
     and ds_removido_em is null
     and codigo ~ '^[0-9]+$'
     and synced_at is not null
     and synced_at < corte;

  if alvo > cap then
    return -alvo;  -- excedeu a trava: aborta (provável sync incompleto)
  end if;

  update produtos
     set ativo = false, ds_removido_em = now()
   where ativo
     and ds_removido_em is null
     and codigo ~ '^[0-9]+$'
     and synced_at is not null
     and synced_at < corte;
  get diagnostics n = row_count;
  return n;
end;
$fr$;
