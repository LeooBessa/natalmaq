-- ============================================================================
-- 0032 — Frete padrão R$6,99 + rótulo por região (gerenciável no admin)
--
-- Antes: regras fixas por faixa de CEP (Natal 25, interior 60, resto 120) sem
-- tela de admin. Agora o padrão é R$6,99 (frete fixo, por_kg=0) e o cliente
-- ajusta preços por região em Admin > Frete. A regra catch-all
-- (00000000-99999999) é o "padrão"/fallback do cálculo.
-- ============================================================================

alter table fretes_regra add column if not exists nome text;

-- Ponto de partida: R$6,99 fixo em todas as faixas (por_kg zerado).
update fretes_regra set valor = 6.99, por_kg = 0;

-- Rótulos amigáveis para as faixas existentes (só onde ainda não houver nome).
update fretes_regra set nome = 'Natal e região'
  where nome is null and faixa_cep_inicio = '59000000';
update fretes_regra set nome = 'Interior do RN'
  where nome is null and faixa_cep_inicio = '59300000';
update fretes_regra set nome = 'Demais regiões (padrão)'
  where nome is null and faixa_cep_inicio = '00000000' and faixa_cep_fim = '99999999';

-- Garante a regra padrão (catch-all) — é o fallback quando nenhuma região casa.
insert into fretes_regra (uf, faixa_cep_inicio, faixa_cep_fim, valor, prazo_dias, por_kg, ordem, nome)
select null, '00000000', '99999999', 6.99, 3, 0, 999, 'Demais regiões (padrão)'
where not exists (
  select 1 from fretes_regra
  where faixa_cep_inicio = '00000000' and faixa_cep_fim = '99999999'
);
