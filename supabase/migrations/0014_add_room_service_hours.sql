alter table businesses
add column if not exists room_service_open_time time;

alter table businesses
add column if not exists room_service_close_time time;
