create table if not exists nova_support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique default ('NST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  resume_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  business_id uuid not null references businesses(id) on delete cascade,
  business_name_snapshot text not null,
  room text,
  status text not null default 'OPEN' check (status in ('OPEN', 'PLACED', 'CANCELLED', 'CLOSED_TIMEOUT')),
  customer_phone text,
  note text,
  cart_json jsonb not null default '[]'::jsonb,
  subtotal_npr int not null check (subtotal_npr >= 0),
  delivery_charge_npr int not null check (delivery_charge_npr >= 0),
  total_npr int not null check (total_npr >= 0),
  placed_order_id uuid references nova_orders(id) on delete set null,
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nova_support_tickets_status_created on nova_support_tickets(status, created_at desc);
create index if not exists idx_nova_support_tickets_business_room on nova_support_tickets(business_id, room, created_at desc);

create table if not exists nova_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references nova_support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('CUSTOMER', 'OPS', 'SYSTEM')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_nova_support_messages_ticket_created on nova_support_messages(ticket_id, created_at asc);

alter table nova_support_tickets enable row level security;
alter table nova_support_messages enable row level security;

drop policy if exists nova_support_tickets_public_insert_enabled_business on nova_support_tickets;
create policy nova_support_tickets_public_insert_enabled_business
on nova_support_tickets
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

drop policy if exists nova_support_tickets_central_ops_select on nova_support_tickets;
create policy nova_support_tickets_central_ops_select
on nova_support_tickets
for select
using (is_central_ops());

drop policy if exists nova_support_tickets_central_ops_update on nova_support_tickets;
create policy nova_support_tickets_central_ops_update
on nova_support_tickets
for update
using (is_central_ops())
with check (is_central_ops());

drop policy if exists nova_support_tickets_superadmin_all on nova_support_tickets;
create policy nova_support_tickets_superadmin_all
on nova_support_tickets
for all
using (is_superadmin())
with check (is_superadmin());

drop policy if exists nova_support_messages_public_insert_for_enabled_ticket on nova_support_messages;
create policy nova_support_messages_public_insert_for_enabled_ticket
on nova_support_messages
for insert
with check (
  sender_type in ('CUSTOMER', 'SYSTEM')
  and exists (
    select 1
    from nova_support_tickets t
    join businesses b on b.id = t.business_id
    where t.id = ticket_id
      and b.is_active = true
      and b.enable_nova_delivers_menu = true
      and b.enable_nova_delivers_ordering = true
  )
);

drop policy if exists nova_support_messages_central_ops_select on nova_support_messages;
create policy nova_support_messages_central_ops_select
on nova_support_messages
for select
using (
  exists (
    select 1
    from nova_support_tickets t
    where t.id = ticket_id
      and is_central_ops()
  )
);

drop policy if exists nova_support_messages_central_ops_insert on nova_support_messages;
create policy nova_support_messages_central_ops_insert
on nova_support_messages
for insert
with check (
  sender_type in ('OPS', 'SYSTEM')
  and exists (
    select 1
    from nova_support_tickets t
    where t.id = ticket_id
      and is_central_ops()
  )
);

drop policy if exists nova_support_messages_superadmin_all on nova_support_messages;
create policy nova_support_messages_superadmin_all
on nova_support_messages
for all
using (is_superadmin())
with check (is_superadmin());

create or replace function close_expired_nova_support_tickets()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count int;
begin
  update nova_support_tickets
  set status = 'CLOSED_TIMEOUT',
      updated_at = now()
  where status = 'OPEN'
    and expires_at <= now();

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
