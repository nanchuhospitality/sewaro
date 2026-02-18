alter table nova_orders
  alter column business_id drop not null;

alter table nova_orders
  add column if not exists hotel_google_map_link text;

alter table nova_orders
  drop constraint if exists nova_orders_source_check;

alter table nova_orders
  add constraint nova_orders_source_check
  check (source in ('WHATSAPP', 'OTP', 'HELP_CHAT', 'DIRECT'));
