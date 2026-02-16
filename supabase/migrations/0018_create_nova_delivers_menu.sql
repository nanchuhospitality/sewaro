create table if not exists nova_delivers_menu (
  id int primary key default 1 check (id = 1),
  categories jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table nova_delivers_menu enable row level security;

drop policy if exists nova_delivers_menu_public_select on nova_delivers_menu;
create policy nova_delivers_menu_public_select
on nova_delivers_menu
for select
using (true);

drop policy if exists nova_delivers_menu_superadmin_all on nova_delivers_menu;
create policy nova_delivers_menu_superadmin_all
on nova_delivers_menu
for all
using (is_superadmin())
with check (is_superadmin());
