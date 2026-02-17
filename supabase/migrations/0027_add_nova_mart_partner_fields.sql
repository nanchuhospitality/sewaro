alter table businesses
add column if not exists enable_nova_mart_menu boolean not null default false;

alter table businesses
add column if not exists enable_nova_mart_ordering boolean not null default false;

alter table businesses
add column if not exists nova_mart_commission_percent int not null default 0;

alter table businesses
add column if not exists nova_mart_delivery_charge_npr int not null default 0;

alter table businesses
add column if not exists nova_mart_support_phone text;
