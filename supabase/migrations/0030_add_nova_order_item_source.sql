alter table nova_order_items
add column if not exists source text;

update nova_order_items
set source = 'DELIVERS'
where source is null;

alter table nova_order_items
alter column source set not null;

alter table nova_order_items
drop constraint if exists nova_order_items_source_check;

alter table nova_order_items
add constraint nova_order_items_source_check
check (source in ('DELIVERS', 'MART'));

create index if not exists idx_nova_order_items_order_source
on nova_order_items(order_id, source);
