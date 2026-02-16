drop policy if exists nova_orders_public_insert_enabled_business on nova_orders;
create policy nova_orders_public_insert_enabled_business
on nova_orders
for insert
with check (
  exists (
    select 1
    from businesses b
    where b.id = business_id
      and b.is_active = true
      and b.enable_nova_delivers_menu = true
      and b.enable_nova_delivers_ordering = true
  )
  or is_central_ops()
);

drop policy if exists nova_order_items_public_insert_for_enabled_order on nova_order_items;
create policy nova_order_items_public_insert_for_enabled_order
on nova_order_items
for insert
with check (
  exists (
    select 1
    from nova_orders o
    join businesses b on b.id = o.business_id
    where o.id = order_id
      and b.is_active = true
      and b.enable_nova_delivers_menu = true
      and b.enable_nova_delivers_ordering = true
  )
  or exists (
    select 1
    from nova_orders o
    where o.id = order_id
      and is_central_ops()
  )
);
