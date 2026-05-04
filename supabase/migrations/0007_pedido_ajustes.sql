-- Forma de pagamento no pedido (informada pelo admin)
alter table pedidos add column if not exists forma_pagamento text;

-- Disponibilidade por item (admin pode marcar "sem estoque")
alter table pedido_itens add column if not exists disponivel boolean not null default true;
