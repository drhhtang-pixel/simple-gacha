-- Course sessions the teacher opens for sign-up, and the students' group entries.
create table if not exists sessions (
  id serial primary key,
  course_date date not null,
  title text not null,
  class_code text not null unique,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists submissions (
  id serial primary key,
  session_id int not null references sessions(id) on delete cascade,
  student_id text not null,
  name text not null,
  group_no int not null check (group_no between 1 and 99),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

-- Supabase publishes the public schema through its REST API with the shareable anon key.
-- RLS with no policies blocks that path; the API functions connect as the owner and are unaffected.
alter table sessions enable row level security;
alter table submissions enable row level security;
