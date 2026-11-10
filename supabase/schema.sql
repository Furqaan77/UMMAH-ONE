-- Ummah One: Supabase tables for chat history and feedback.
-- Run in the Supabase SQL editor. Login (phone OTP) uses Supabase Auth.

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamptz not null default now()
);

-- Feedback from 👍 / 👎. Read by the team only (service role).
create table if not exists feedback (
  id bigint generated always as identity primary key,
  chat_id text,
  message_id text not null,
  rating text not null check (rating in ('up', 'down')),
  comment text,
  question text,
  answer text,
  created_at timestamptz not null default now()
);

alter table chats enable row level security;
alter table messages enable row level security;
alter table feedback enable row level security;

-- Users see and delete only their own chats (GDPR: deleting a chat deletes its messages).
create policy "own chats" on chats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages" on messages for all
  using (exists (select 1 from chats c where c.id = chat_id and c.user_id = auth.uid()))
  with check (exists (select 1 from chats c where c.id = chat_id and c.user_id = auth.uid()));
-- No policies on feedback: only the server (service role key) can write or read it.
