alter table menu_categories
add column if not exists parent_id uuid references menu_categories(id) on delete cascade;

create index if not exists idx_menu_categories_parent_sort
  on menu_categories(parent_id, sort_order);
