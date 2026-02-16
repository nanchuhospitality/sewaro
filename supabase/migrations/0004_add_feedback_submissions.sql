create table if not exists feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  factors text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_submissions_business_created
on feedback_submissions (business_id, created_at desc);

alter table feedback_submissions enable row level security;

drop policy if exists feedback_public_insert on feedback_submissions;
create policy feedback_public_insert
on feedback_submissions
for insert
with check (
  exists (
    select 1 from businesses b where b.id = business_id and b.is_active = true
  )
);

drop policy if exists feedback_admin_select_own on feedback_submissions;
create policy feedback_admin_select_own
on feedback_submissions
for select
using (is_business_admin_for(business_id));

drop policy if exists feedback_superadmin_all on feedback_submissions;
create policy feedback_superadmin_all
on feedback_submissions
for all
using (is_superadmin())
with check (is_superadmin());
