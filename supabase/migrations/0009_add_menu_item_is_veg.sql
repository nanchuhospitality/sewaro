alter table menu_items
add column if not exists is_veg boolean not null default true;
