alter table feedback_submissions
add column if not exists room text;

alter table feedback_submissions
drop constraint if exists feedback_submissions_room_chk;

alter table feedback_submissions
add constraint feedback_submissions_room_chk
check (room is null or room ~ '^[a-z0-9-]{1,20}$');

create index if not exists idx_feedback_submissions_business_room_created
on feedback_submissions (business_id, room, created_at desc);
