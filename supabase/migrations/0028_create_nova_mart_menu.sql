create table if not exists nova_mart_menu (
  id int primary key default 1 check (id = 1),
  categories jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table nova_mart_menu enable row level security;

drop policy if exists nova_mart_menu_public_select on nova_mart_menu;
create policy nova_mart_menu_public_select
on nova_mart_menu
for select
using (true);

drop policy if exists nova_mart_menu_superadmin_all on nova_mart_menu;
create policy nova_mart_menu_superadmin_all
on nova_mart_menu
for all
using (is_superadmin())
with check (is_superadmin());
