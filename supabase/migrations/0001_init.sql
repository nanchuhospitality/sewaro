-- Sewaro MVP schema + RLS

create extension if not exists pgcrypto;

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  hours_text text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint businesses_slug_reserved_chk check (
    lower(slug) not in ('login','dashboard','superadmin','admin','api','assets','h','m')
  )
);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('SUPERADMIN','BUSINESS_ADMIN')),
  business_id uuid references businesses(id),
  created_at timestamptz not null default now()
);

create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  price_npr int not null check (price_npr >= 0),
  description text,
  image_url text,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists menu_page_views (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  slug text not null,
  room text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_menu_categories_business_sort on menu_categories(business_id, sort_order);
create index if not exists idx_menu_items_business_category_sort on menu_items(business_id, category_id, sort_order);
create index if not exists idx_menu_page_views_business_created on menu_page_views(business_id, created_at);

create or replace function is_superadmin()
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
      and p.role = 'SUPERADMIN'
  );
$$;

create or replace function is_business_admin_for(target_business_id uuid)
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
      and p.role = 'BUSINESS_ADMIN'
      and p.business_id = target_business_id
  );
$$;

alter table businesses enable row level security;
alter table profiles enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_page_views enable row level security;

-- businesses
drop policy if exists businesses_public_active_select on businesses;
create policy businesses_public_active_select
on businesses
for select
using (is_active = true);

drop policy if exists businesses_admin_select_own on businesses;
create policy businesses_admin_select_own
on businesses
for select
using (is_business_admin_for(id));

drop policy if exists businesses_admin_update_own on businesses;
create policy businesses_admin_update_own
on businesses
for update
using (is_business_admin_for(id))
with check (is_business_admin_for(id));

drop policy if exists businesses_admin_insert on businesses;
create policy businesses_admin_insert
on businesses
for insert
with check (
  exists (
    select 1 from profiles p
    where p.user_id = auth.uid()
      and p.role = 'BUSINESS_ADMIN'
  )
);

drop policy if exists businesses_superadmin_all on businesses;
create policy businesses_superadmin_all
on businesses
for all
using (is_superadmin())
with check (is_superadmin());

-- profiles
drop policy if exists profiles_superadmin_all on profiles;
create policy profiles_superadmin_all
on profiles
for all
using (is_superadmin())
with check (is_superadmin());

drop policy if exists profiles_admin_read_self on profiles;
create policy profiles_admin_read_self
on profiles
for select
using (user_id = auth.uid());

drop policy if exists profiles_admin_update_self on profiles;
create policy profiles_admin_update_self
on profiles
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- menu_categories
drop policy if exists categories_public_select_active_business on menu_categories;
create policy categories_public_select_active_business
on menu_categories
for select
using (
  exists (
    select 1 from businesses b where b.id = business_id and b.is_active = true
  )
);

drop policy if exists categories_admin_manage_own on menu_categories;
create policy categories_admin_manage_own
on menu_categories
for all
using (is_business_admin_for(business_id))
with check (is_business_admin_for(business_id));

drop policy if exists categories_superadmin_all on menu_categories;
create policy categories_superadmin_all
on menu_categories
for all
using (is_superadmin())
with check (is_superadmin());

-- menu_items
drop policy if exists items_public_select_active_business on menu_items;
create policy items_public_select_active_business
on menu_items
for select
using (
  exists (
    select 1 from businesses b where b.id = business_id and b.is_active = true
  )
);

drop policy if exists items_admin_manage_own on menu_items;
create policy items_admin_manage_own
on menu_items
for all
using (is_business_admin_for(business_id))
with check (is_business_admin_for(business_id));

drop policy if exists items_superadmin_all on menu_items;
create policy items_superadmin_all
on menu_items
for all
using (is_superadmin())
with check (is_superadmin());

-- menu_page_views
drop policy if exists menu_page_views_public_insert on menu_page_views;
create policy menu_page_views_public_insert
on menu_page_views
for insert
with check (
  exists (
    select 1 from businesses b where b.id = business_id and b.is_active = true
  )
);

drop policy if exists menu_page_views_admin_select_own on menu_page_views;
create policy menu_page_views_admin_select_own
on menu_page_views
for select
using (is_business_admin_for(business_id));

drop policy if exists menu_page_views_superadmin_all on menu_page_views;
create policy menu_page_views_superadmin_all
on menu_page_views
for all
using (is_superadmin())
with check (is_superadmin());

-- Storage bucket + policies
insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do nothing;

drop policy if exists "business-assets public read" on storage.objects;
create policy "business-assets public read"
on storage.objects
for select
using (bucket_id = 'business-assets');

drop policy if exists "business-assets admin upload" on storage.objects;
create policy "business-assets admin upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-assets' and (is_superadmin() or exists (
    select 1 from profiles p
    where p.user_id = auth.uid()
      and p.role = 'BUSINESS_ADMIN'
  ))
);

drop policy if exists "business-assets admin update" on storage.objects;
create policy "business-assets admin update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-assets' and (is_superadmin() or exists (
    select 1 from profiles p
    where p.user_id = auth.uid()
      and p.role = 'BUSINESS_ADMIN'
  ))
)
with check (
  bucket_id = 'business-assets' and (is_superadmin() or exists (
    select 1 from profiles p
    where p.user_id = auth.uid()
      and p.role = 'BUSINESS_ADMIN'
  ))
);

drop policy if exists "business-assets admin delete" on storage.objects;
create policy "business-assets admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-assets' and (is_superadmin() or exists (
    select 1 from profiles p
    where p.user_id = auth.uid()
      and p.role = 'BUSINESS_ADMIN'
  ))
);
