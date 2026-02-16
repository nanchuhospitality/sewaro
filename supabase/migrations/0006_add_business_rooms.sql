create table if not exists business_rooms (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  room_code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint business_rooms_code_chk check (room_code ~ '^[a-z0-9-]{1,20}$'),
  constraint business_rooms_business_code_key unique (business_id, room_code)
);

create index if not exists idx_business_rooms_business_code
on business_rooms (business_id, room_code);

alter table business_rooms enable row level security;

drop policy if exists business_rooms_admin_manage_own on business_rooms;
create policy business_rooms_admin_manage_own
on business_rooms
for all
using (is_business_admin_for(business_id))
with check (is_business_admin_for(business_id));

drop policy if exists business_rooms_superadmin_all on business_rooms;
create policy business_rooms_superadmin_all
on business_rooms
for all
using (is_superadmin())
with check (is_superadmin());
