create or replace function is_central_ops()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    where p.user_id = auth.uid()
      and p.role = 'CENTRAL_OPS'
  );
$$;

create table if not exists nova_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default ('ND-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  business_id uuid not null references businesses(id) on delete cascade,
  business_name_snapshot text not null,
  room text,
  source text not null check (source in ('WHATSAPP', 'OTP', 'HELP_CHAT')),
  status text not null default 'NEW' check (status in ('NEW', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
  customer_phone text,
  note text,
  subtotal_npr int not null check (subtotal_npr >= 0),
  delivery_charge_npr int not null check (delivery_charge_npr >= 0),
  total_npr int not null check (total_npr >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nova_orders_created_desc on nova_orders(created_at desc);
create index if not exists idx_nova_orders_status_created on nova_orders(status, created_at desc);
create index if not exists idx_nova_orders_business_room_created on nova_orders(business_id, room, created_at desc);

create table if not exists nova_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references nova_orders(id) on delete cascade,
  item_name text not null,
  variant_name text,
  quantity int not null check (quantity > 0),
  unit_price_npr int not null check (unit_price_npr >= 0),
  line_total_npr int not null check (line_total_npr >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_nova_order_items_order on nova_order_items(order_id);

alter table nova_orders enable row level security;
alter table nova_order_items enable row level security;

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
);

drop policy if exists nova_orders_central_ops_select on nova_orders;
create policy nova_orders_central_ops_select
on nova_orders
for select
using (is_central_ops());

drop policy if exists nova_orders_central_ops_update on nova_orders;
create policy nova_orders_central_ops_update
on nova_orders
for update
using (is_central_ops())
with check (is_central_ops());

drop policy if exists nova_orders_superadmin_all on nova_orders;
create policy nova_orders_superadmin_all
on nova_orders
for all
using (is_superadmin())
with check (is_superadmin());

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
);

drop policy if exists nova_order_items_central_ops_select on nova_order_items;
create policy nova_order_items_central_ops_select
on nova_order_items
for select
using (
  exists (
    select 1
    from nova_orders o
    where o.id = order_id
      and is_central_ops()
  )
);

drop policy if exists nova_order_items_superadmin_all on nova_order_items;
create policy nova_order_items_superadmin_all
on nova_order_items
for all
using (is_superadmin())
with check (is_superadmin());
