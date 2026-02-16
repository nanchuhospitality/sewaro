alter table businesses
drop constraint if exists businesses_slug_reserved_chk;

alter table businesses
add constraint businesses_slug_reserved_chk check (
  lower(slug) not in ('login','dashboard','superadmin','ops','support','track','admin','api','assets','h','m')
);
