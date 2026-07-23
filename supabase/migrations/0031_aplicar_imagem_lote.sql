-- ============================================================================
-- 0031 — Aplicar uma mesma foto em vários produtos de uma vez
--
-- `imagens` é jsonb (array de URLs). Este RPC anexa a URL informada em todos os
-- produtos da lista `ids`, sem duplicar (se já tem, não repete). Roda em uma
-- única transação — muito mais rápido/atômico que N updates do lado do app.
-- Guarda is_admin() porque é security definer (ignora a RLS).
-- ============================================================================

create or replace function public.admin_aplicar_imagem(ids uuid[], url text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;
  if url is null or length(trim(url)) = 0 then
    raise exception 'URL da imagem vazia';
  end if;

  update produtos
     set imagens = case
                     when imagens @> to_jsonb(url) then imagens        -- já tem: não duplica
                     else imagens || to_jsonb(url)                     -- anexa no fim
                   end
   where id = any(ids);

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.admin_aplicar_imagem(uuid[], text) to authenticated;
