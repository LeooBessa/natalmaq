-- ============================================================================
-- GRANTs explicitos pra Data API (Postgrest, GraphQL, supabase-js)
-- ============================================================================
-- Motivacao: a partir de 30/out/2026 o Supabase vai parar de expor tabelas
-- do schema public na Data API automaticamente. Sera necessario GRANT
-- explicito (https://supabase.com/changelog).
--
-- Esta migration replica o default ATUAL do Supabase (GRANT ALL pra anon,
-- authenticated e service_role) tanto pras tabelas EXISTENTES quanto pras
-- futuras. A seguranca real continua sendo a RLS, que ja esta ativa em
-- todas as 15 tabelas do projeto (auditado no Security Advisor).
--
-- Sem esta migration, em 30/out/2026 o site quebra: catalogo vazio, login
-- nao funciona, admin morre, endpoints Python falham.
--
-- Rollback: REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--           (NAO recomendado em prod sem analise caso a caso)
-- ============================================================================

-- Schema acessivel
grant usage on schema public to anon, authenticated, service_role;

-- Tudo pras tabelas atuais (15 tabelas: admins, avaliacoes, banners,
-- carrinho_itens, categorias, clientes, cupons, fretes_regra, imports,
-- imports_fotos, marcas, pedido_itens, pedidos, produto_enriquecimento, produtos)
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- Defaults pra futuras tabelas criadas pelo role postgres (todas as nossas
-- migrations rodam como postgres no Supabase). Sem isso, qualquer tabela
-- nova criada apos a migration nao teria GRANT e ficaria invisivel pra
-- Data API mesmo com RLS configurada.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on routines to anon, authenticated, service_role;
