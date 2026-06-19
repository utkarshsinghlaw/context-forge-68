create extension if not exists vector with schema extensions;

create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id uuid,
  source_type text not null,
  source_id uuid not null,
  source_title text not null default '',
  chunk_index int not null default 0,
  content text not null default '',
  embedding extensions.vector(1536),
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.chunks to authenticated;
grant all on public.chunks to service_role;

alter table public.chunks enable row level security;

create policy "Users manage own chunks" on public.chunks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index chunks_embedding_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index chunks_fts_idx on public.chunks using gin (fts);
create index chunks_workspace_idx on public.chunks (workspace_id);
create index chunks_source_idx on public.chunks (source_type, source_id);

create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  p_workspace_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  source_title text,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.source_type,
    c.source_id,
    c.source_title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.user_id = auth.uid()
    and (p_workspace_id is null or c.workspace_id = p_workspace_id or c.workspace_id is null)
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_chunks(extensions.vector, uuid, int) to authenticated;