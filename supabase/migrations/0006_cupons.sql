-- ----------------------------------------------------------------------------
-- Cupons de desconto
-- ----------------------------------------------------------------------------
create table cupons (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null,
  descricao    text,
  tipo         text not null check (tipo in ('percentual', 'fixo')),
  valor        numeric(10,2) not null check (valor > 0),
  valor_minimo numeric(10,2) not null default 0,
  usos_max     int,          -- null = ilimitado
  usos_atual   int not null default 0,
  ativo        boolean not null default true,
  exibir_home  boolean not null default false,
  validade     timestamptz,  -- null = sem validade
  created_at   timestamptz not null default now(),
  constraint cupons_codigo_upper check (codigo = upper(codigo)),
  unique (codigo)
);

alter table cupons enable row level security;

-- Admin: acesso total
create policy "admin all cupons" on cupons
  for all using (public.is_admin()) with check (public.is_admin());

-- Anon: lê só cupons marcados para exibir na home
create policy "public select cupons home" on cupons
  for select using (ativo = true and exibir_home = true);

-- ----------------------------------------------------------------------------
-- Adiciona colunas de cupom ao pedido
-- ----------------------------------------------------------------------------
alter table pedidos
  add column if not exists cupom_codigo    text,
  add column if not exists desconto_valor  numeric(10,2) not null default 0;
