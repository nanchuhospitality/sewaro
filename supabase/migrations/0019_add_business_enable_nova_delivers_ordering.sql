alter table businesses
add column if not exists enable_nova_delivers_ordering boolean not null default false;
