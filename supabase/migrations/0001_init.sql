-- Extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type workspace_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type document_status as enum ('pending', 'processing', 'ready', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type message_role as enum ('user', 'assistant');
exception
  when duplicate_object then null;
end $$;

-- Profiles (mirror of auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, new.email) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Workspaces
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references profiles(id) on delete cascade,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists one_demo_workspace on workspaces ((true)) where is_demo;

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_id_idx on workspace_members (user_id);

-- Documents (also acts as the ingestion job queue)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  uploader_id uuid references profiles(id) on delete set null,
  filename text not null,                 -- display name only, sanitized
  storage_path text,                      -- {workspace_id}/{document_id}/original (never user-supplied)
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null,
  status document_status not null default 'pending',
  error_message text,
  page_count int,
  chunk_count int not null default 0,
  attempts int not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (workspace_id, sha256)
);
create index if not exists documents_workspace_created_idx on documents (workspace_id, created_at desc);
create index if not exists documents_status_locked_idx on documents (status, locked_at) where status in ('pending','processing');

-- Chunks + vectors
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  content_sha256 text not null,
  token_count int not null,
  page_start int,
  page_end int,
  section_title text,
  embedding vector(768) not null,
  embedding_model text not null,
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);
create index if not exists document_chunks_workspace_idx on document_chunks (workspace_id);
create index if not exists document_chunks_doc_idx on document_chunks (document_id);
create index if not exists chunks_fts_idx on document_chunks using gin (fts);

-- Embedding cache (saves quota on re-uploads)
create table if not exists embedding_cache (
  content_sha256 text not null,
  model text not null,
  embedding vector(768) not null,
  primary key (content_sha256, model)
);

-- Conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_ws_user_updated_idx on conversations (workspace_id, user_id, updated_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role message_role not null,
  content text not null,
  citations jsonb not null default '[]',   -- [{chunk_id, document_id, filename, page_start, page_end, section_title, score}]
  grounded boolean,                        -- assistant only: false = "not found" fallback
  model text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_created_idx on messages (conversation_id, created_at);

create table if not exists message_feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create table if not exists unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  message_id uuid references messages(id) on delete set null,
  question text not null,
  top_score real,
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  created_at timestamptz not null default now()
);
create index if not exists unanswered_questions_ws_status_idx on unanswered_questions (workspace_id, status, created_at desc);

-- Quotas / abuse control / audit
create table if not exists usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  ip_hash text,                             -- sha256(ip + daily salt), never raw IP
  workspace_id uuid references workspaces(id) on delete set null,
  kind text not null check (kind in ('question','upload','embed_call','llm_call','demo_question')),
  units int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_kind_idx on usage_events (user_id, kind, created_at desc);
create index if not exists usage_events_ip_kind_idx on usage_events (ip_hash, kind, created_at desc);
create index if not exists usage_events_kind_created_idx on usage_events (kind, created_at desc);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  workspace_id uuid,
  action text not null,                     -- e.g. 'upload_ack', 'document_delete', 'workspace_delete'
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);
insert into app_settings (key, value) values
  ('uploads_enabled', 'true'),
  ('chat_enabled', 'true'),
  ('global_max_chunks', '20000')
on conflict (key) do nothing;

-- Vector search function (always workspace-scoped)
create or replace function match_chunks(
  p_workspace_id uuid,
  p_query vector(768),
  p_k int default 5,
  p_document_ids uuid[] default null
) returns table (
  id uuid, document_id uuid, filename text, content text,
  page_start int, page_end int, section_title text, similarity float
) language sql stable as $$
  select c.id, c.document_id, d.filename, c.content, c.page_start, c.page_end,
         c.section_title, (1 - (c.embedding <=> p_query))::float as similarity
  from document_chunks c
  join documents d on d.id = c.document_id and d.status = 'ready'
  where c.workspace_id = p_workspace_id
    and (p_document_ids is null or c.document_id = any(p_document_ids))
  order by c.embedding <=> p_query
  limit p_k;
$$;

-- Atomic job claim for the ingestion worker
create or replace function claim_document_job(p_stale_after interval default '10 minutes')
returns setof documents language plpgsql as $$
begin
  return query
  update documents set status='processing', locked_at=now(), attempts=attempts+1
  where id = (
    select id from documents
    where (status='pending' or (status='processing' and locked_at < now() - p_stale_after))
      and attempts < 3
    order by created_at
    for update skip locked limit 1)
  returning *;
end $$;

-- Row Level Security: enabled everywhere
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table embedding_cache enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table message_feedback enable row level security;
alter table unanswered_questions enable row level security;
alter table usage_events enable row level security;
alter table audit_log enable row level security;
alter table app_settings enable row level security;

-- Minimal read policies (so nothing leaks if the Supabase REST API is hit directly)
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for select using (id = auth.uid());

drop policy if exists "member workspaces" on workspaces;
create policy "member workspaces" on workspaces for select
  using (exists (select 1 from workspace_members m where m.workspace_id = id and m.user_id = auth.uid()));

drop policy if exists "own memberships" on workspace_members;
create policy "own memberships" on workspace_members for select using (user_id = auth.uid());

drop policy if exists "member documents" on documents;
create policy "member documents" on documents for select
  using (exists (select 1 from workspace_members m where m.workspace_id = documents.workspace_id and m.user_id = auth.uid()));

drop policy if exists "own conversations" on conversations;
create policy "own conversations" on conversations for select using (user_id = auth.uid());

drop policy if exists "own messages" on messages;
create policy "own messages" on messages for select
  using (exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid()));

-- Revoke direct API access to sensitive tables as well
revoke all on document_chunks, embedding_cache, usage_events, audit_log, app_settings from anon, authenticated;

