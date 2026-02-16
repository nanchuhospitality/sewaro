alter table businesses
add column if not exists enable_nova_delivers_menu boolean not null default false;
