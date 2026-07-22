-- ============================================================================
-- 0030 — Promoção manual: admin trava o preço promocional contra o sync do DS
--
-- Problema: o DS (ERP) é dono de preco_promocional e o RPC de sync o reescreve
-- de hora em hora. Quando o admin definia uma promoção pela tela, o próximo
-- sync a apagava (o DS manda vazio, ou um valor de promoção próprio — às vezes
-- lixo, tipo R$ 3,00 num produto de R$ 35).
--
-- Solução: coluna `promo_travada`. Quando true, o sync NÃO toca em
-- preco_promocional daquele produto — o valor do admin manda. Quando false
-- (padrão), o DS segue controlando, como sempre. A trava é ligada pela própria
-- tela de produto ao salvar uma promoção.
-- ============================================================================

alter table produtos
  add column if not exists promo_travada boolean not null default false;

-- Recria o RPC do 0027 idêntico, mudando SÓ a linha do preco_promocional no
-- ON CONFLICT: agora respeita a trava (mantém o valor existente se travado).
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
    -- promo_travada => admin é dono; mantém o valor atual e ignora o do DS
    preco_promocional = case
                          when p.promo_travada then p.preco_promocional
                          else excluded.preco_promocional
                        end,
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
