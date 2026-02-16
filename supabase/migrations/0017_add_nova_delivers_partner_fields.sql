alter table businesses
add column if not exists nova_delivers_commission_percent int not null default 0;

alter table businesses
add column if not exists nova_delivers_delivery_charge_npr int not null default 0;
