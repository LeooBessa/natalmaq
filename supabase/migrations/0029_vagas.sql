-- Vagas de emprego: o admin anuncia vagas em /admin/vagas. As vagas ativas
-- aparecem na seção "Trabalhe conosco" do institucional. Opcionalmente o admin
-- gera um banner (linha na tabela `banners`) apontando pra essa seção.

create table if not exists vagas (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  descricao  text not null default '',
  tipo       text,                 -- ex.: CLT, Estágio, PJ, Temporário
  local      text,                 -- ex.: Natal/RN, Remoto
  ativo      boolean not null default true,
  ordem      int not null default 0,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_vagas_ativas on vagas (ativo, ordem);

grant all on table vagas to anon, authenticated, service_role;

alter table vagas enable row level security;

-- Leitura pública apenas das vagas ATIVAS (institucional).
drop policy if exists "vagas read ativas" on vagas;
create policy "vagas read ativas" on vagas
  for select using (ativo = true);

-- Admin faz tudo (espelha o padrão de banners/cupons via is_admin()).
drop policy if exists "admin all vagas" on vagas;
create policy "admin all vagas" on vagas
  for all using (public.is_admin()) with check (public.is_admin());
