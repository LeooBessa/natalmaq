-- ============================================================================
-- Natalmaq — Clientes, carrinho persistente e link pedido↔cliente
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Clientes (perfil dos usuários do e-commerce)
-- ----------------------------------------------------------------------------
create table clientes (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text not null,
  contato   text not null,
  email     text not null,
  endereco  jsonb,         -- {cep, rua, numero, bairro, cidade, uf, complemento}
  criado_em timestamptz not null default now()
);

alter table clientes enable row level security;

-- Cliente lê e edita apenas seus próprios dados
create policy "cliente select"  on clientes for select using (auth.uid() = id);
create policy "cliente insert"  on clientes for insert with check (auth.uid() = id);
create policy "cliente update"  on clientes for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Admin vê/edita todos os clientes
create policy "admin all clientes" on clientes
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Carrinho persistente (sincronizado entre dispositivos)
-- ----------------------------------------------------------------------------
create table carrinho_itens (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references auth.users(id) on delete cascade,
  produto_id    uuid not null references produtos(id)   on delete cascade,
  codigo        text not null,
  slug          text not null,
  nome          text not null,
  imagem        text,
  preco_unit    numeric(12,2) not null,
  quantidade    int not null default 1 check (quantidade > 0),
  estoque       int not null default 0,
  peso_kg       numeric(8,3) not null default 0,
  adicionado_em timestamptz not null default now(),
  unique (cliente_id, produto_id)
);

alter table carrinho_itens enable row level security;

-- Cliente gerencia apenas seu próprio carrinho (select/insert/update/delete)
create policy "cliente all carrinho" on carrinho_itens
  for all
  using  (auth.uid() = cliente_id)
  with check (auth.uid() = cliente_id);

-- ----------------------------------------------------------------------------
-- Link pedido ↔ cliente (nullable — pedidos antigos/anônimos mantidos)
-- ----------------------------------------------------------------------------
alter table pedidos
  add column if not exists cliente_id uuid references auth.users(id) on delete set null;

create index idx_pedidos_cliente
  on pedidos(cliente_id)
  where cliente_id is not null;

-- Cliente vê apenas seus próprios pedidos
create policy "cliente select pedidos" on pedidos
  for select using (auth.uid() = cliente_id);

-- Cliente vê os itens dos seus pedidos
create policy "cliente select pedido_itens" on pedido_itens
  for select using (
    exists (
      select 1 from pedidos p
      where p.id = pedido_id
        and p.cliente_id = auth.uid()
    )
  );
