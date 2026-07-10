create or replace function public.match_chunks_global(query_embedding extensions.vector, match_count integer default 12)
returns table(id uuid, workspace_id uuid, source_type text, source_id uuid, source_title text, content text, similarity double precision)
language sql
stable
set search_path to 'public', 'extensions'
as $function$
  select
    c.id,
    c.workspace_id,
    c.source_type,
    c.source_id,
    c.source_title,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.user_id = auth.uid()
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$function$;

grant execute on function public.match_chunks_global(extensions.vector, integer) to authenticated;