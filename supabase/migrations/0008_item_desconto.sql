-- Desconto percentual por item (aplicado pelo admin no painel)
alter table pedido_itens add column if not exists desconto_perc numeric(5,2) not null default 0;
