alter table profiles
drop constraint if exists profiles_role_check;

alter table profiles
add constraint profiles_role_check
check (role in ('SUPERADMIN','BUSINESS_ADMIN','CENTRAL_OPS'));
