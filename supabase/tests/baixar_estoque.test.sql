-- Smoke tests para o trigger pedidos_baixar_estoque (migration 0013).
-- Como rodar: abra o SQL Editor do Supabase e execute bloco por bloco.
-- Cada bloco imprime um resultado que deve casar com o comentario "esperado".

-- IMPORTANTE: roda dentro de transacao com ROLLBACK pra nao sujar dados.

-- ============================================================================
-- Cenario 1: status 'pendente' -> 'enviado' baixa estoque dos itens disponiveis
-- Esperado: estoque_apos = estoque_antes - quantidade
-- ============================================================================
begin;
  with prod as (
    select id, estoque from public.produtos where ativo and estoque >= 5 limit 1
  ),
  ped as (
    insert into public.pedidos (cliente_nome, cliente_telefone, total, status)
    values ('teste', '8400000000', 100, 'pendente')
    returning id
  ),
  item as (
    insert into public.pedido_itens (
      pedido_id, produto_id, codigo, nome_snapshot, quantidade, preco_unit, preco_total, disponivel
    )
    select ped.id, prod.id, 'TEST', 'teste', 2, 50, 100, true
    from ped, prod
    returning pedido_id, produto_id, quantidade
  ),
  estoque_antes as (
    select prod.estoque as antes from prod
  ),
  update_pedido as (
    update public.pedidos set status = 'enviado' where id = (select id from ped) returning estoque_baixado_em
  )
  select
    (select antes from estoque_antes) as estoque_antes,
    (select estoque from public.produtos where id = (select produto_id from item)) as estoque_depois,
    (select estoque_baixado_em from update_pedido) is not null as marcado_baixado;
rollback;
-- Esperado: estoque_depois = estoque_antes - 2 (quantidade); marcado_baixado = true

-- ============================================================================
-- Cenario 2: itens com disponivel=false NAO descontam
-- Esperado: estoque_depois = estoque_antes (nao mudou)
-- ============================================================================
begin;
  with prod as (
    select id, estoque from public.produtos where ativo and estoque >= 5 limit 1
  ),
  ped as (
    insert into public.pedidos (cliente_nome, cliente_telefone, total, status)
    values ('teste indisp', '8400000000', 100, 'pendente') returning id
  ),
  item as (
    insert into public.pedido_itens (
      pedido_id, produto_id, codigo, nome_snapshot, quantidade, preco_unit, preco_total, disponivel
    )
    select ped.id, prod.id, 'TEST', 'teste', 2, 50, 100, false  -- DISPONIVEL = FALSE
    from ped, prod
    returning produto_id
  ),
  estoque_antes as (select prod.estoque as antes from prod)
  ,_ as (update public.pedidos set status = 'enviado' where id = (select id from ped))
  select
    (select antes from estoque_antes) as estoque_antes,
    (select estoque from public.produtos where id = (select produto_id from item)) as estoque_depois;
rollback;

-- ============================================================================
-- Cenario 3: idempotencia - se ja foi baixado, nao baixa de novo
-- Esperado: estoque mantem mesmo valor entre as duas transicoes
-- ============================================================================
begin;
  with prod as (select id, estoque from public.produtos where ativo and estoque >= 10 limit 1),
  ped as (
    insert into public.pedidos (cliente_nome, cliente_telefone, total, status, estoque_baixado_em)
    values ('teste idemp', '8400000000', 100, 'pendente', now())  -- ja com timestamp setado
    returning id
  ),
  item as (
    insert into public.pedido_itens (
      pedido_id, produto_id, codigo, nome_snapshot, quantidade, preco_unit, preco_total, disponivel
    )
    select ped.id, prod.id, 'TEST', 'teste', 3, 50, 150, true
    from ped, prod returning produto_id
  ),
  estoque_antes as (select prod.estoque as antes from prod)
  ,_ as (update public.pedidos set status = 'enviado' where id = (select id from ped))
  select
    (select antes from estoque_antes) as estoque_antes,
    (select estoque from public.produtos where id = (select produto_id from item)) as estoque_depois;
rollback;
-- Esperado: estoque_depois = estoque_antes (nao baixou porque ja foi baixado antes)

-- ============================================================================
-- Cenario 4: estoque nunca fica negativo (GREATEST)
-- Esperado: produto fica com estoque = 0, nao negativo
-- ============================================================================
begin;
  with prod as (select id, estoque from public.produtos where ativo and estoque between 1 and 5 limit 1),
  ped as (
    insert into public.pedidos (cliente_nome, cliente_telefone, total, status)
    values ('teste negativo', '8400000000', 9999, 'pendente') returning id
  ),
  item as (
    insert into public.pedido_itens (
      pedido_id, produto_id, codigo, nome_snapshot, quantidade, preco_unit, preco_total, disponivel
    )
    select ped.id, prod.id, 'TEST', 'teste', 99999, 1, 99999, true  -- quantidade > estoque
    from ped, prod returning produto_id
  )
  ,_ as (update public.pedidos set status = 'enviado' where id = (select id from ped))
  select
    (select estoque from public.produtos where id = (select produto_id from item)) as estoque_final;
rollback;
-- Esperado: estoque_final = 0 (clampado, nao negativo)
