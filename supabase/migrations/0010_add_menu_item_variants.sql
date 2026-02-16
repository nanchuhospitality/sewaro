create table if not exists menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  price_npr int not null check (price_npr >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_item_variants_item_sort
  on menu_item_variants(menu_item_id, sort_order);

alter table menu_item_variants enable row level security;

drop policy if exists item_variants_public_select_active_business on menu_item_variants;
create policy item_variants_public_select_active_business
on menu_item_variants
for select
using (
  exists (
    select 1
    from menu_items mi
    join businesses b on b.id = mi.business_id
    where mi.id = menu_item_id
      and b.is_active = true
  )
);

drop policy if exists item_variants_admin_manage_own on menu_item_variants;
create policy item_variants_admin_manage_own
on menu_item_variants
for all
using (
  exists (
    select 1
    from menu_items mi
    where mi.id = menu_item_id
      and is_business_admin_for(mi.business_id)
  )
)
with check (
  exists (
    select 1
    from menu_items mi
    where mi.id = menu_item_id
      and is_business_admin_for(mi.business_id)
  )
);

drop policy if exists item_variants_superadmin_all on menu_item_variants;
create policy item_variants_superadmin_all
on menu_item_variants
for all
using (is_superadmin())
with check (is_superadmin());
