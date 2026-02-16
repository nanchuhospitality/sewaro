alter table businesses
add column if not exists show_review boolean not null default true;
