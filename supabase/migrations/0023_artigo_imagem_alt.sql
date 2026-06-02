-- ============================================================================
-- Natalmaq — SEO: texto alternativo (alt) da imagem de capa do artigo
-- ============================================================================
-- Adiciona a coluna `imagem_alt` em `artigos`. Antes o alt era só client-side
-- (não persistia) — agora é salvo, usado no <img alt> público e conta no SEO
-- score. Idempotente (add column if not exists). Seguro reaplicar.
--
-- ROLLBACK:  alter table artigos drop column if exists imagem_alt;
-- ============================================================================

alter table artigos add column if not exists imagem_alt text;
