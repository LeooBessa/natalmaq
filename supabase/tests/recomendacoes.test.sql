-- Smoke tests para recomendar_para_carrinho.
-- Como rodar: abra o SQL Editor do Supabase (projeto yfvmjxrtygojnlnkxtmu)
-- e execute bloco por bloco. Cada bloco imprime um resultado que deve casar
-- com o comentário "esperado".

-- Cenário 1: shape do retorno tem `marca` como jsonb com {id, nome, slug}
-- Esperado: 1 linha com marca = {"id": "...", "nome": "...", "slug": "..."} OU null
select id, nome, marca, score
from public.recomendar_para_carrinho(
  array(select id from public.produtos where ativo and produto_pai_id is null limit 1)::uuid[],
  3
);

-- Cenário 2: produto do próprio cart nunca aparece nos resultados
-- Esperado: 0 linhas
with cart as (
  select array(select id from public.produtos where ativo and produto_pai_id is null limit 3) as ids
)
select r.id
from cart, public.recomendar_para_carrinho(cart.ids, 12) r
where r.id = any(cart.ids);

-- Cenário 3: limit clampa em [1,12]
-- Esperado: count <= 12 mesmo passando limit=999
select count(*) as total_clampado
from public.recomendar_para_carrinho(
  array(select id from public.produtos where ativo and produto_pai_id is null limit 2)::uuid[],
  999
);

-- Cenário 4: score de complementares acumula, categoria/marca não
-- (executar manualmente com 2 produtos cujo "complementares" inclua o mesmo terceiro produto)
-- Esperado: aquele terceiro produto tem score >= 20 (10+10), maior que outros candidatos
-- de mesma categoria sozinha (que dariam só +3)
-- [Comentado pra rodar sob demanda quando houver dados de teste]
-- select id, nome, score from public.recomendar_para_carrinho(array['<uuid1>','<uuid2>']::uuid[], 5);
