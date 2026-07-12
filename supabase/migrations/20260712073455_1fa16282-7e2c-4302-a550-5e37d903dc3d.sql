CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.prune_expired_memory()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove search-index chunks that belong to expired memory entries.
  DELETE FROM public.chunks c
  USING public.memory_entries m
  WHERE c.source_type = 'memory'
    AND c.source_id = m.id
    AND m.expires_at IS NOT NULL
    AND m.expires_at < now();

  -- Remove the expired memory entries themselves.
  DELETE FROM public.memory_entries
  WHERE expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;

REVOKE ALL ON FUNCTION public.prune_expired_memory() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('prune-expired-memory')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-expired-memory');

SELECT cron.schedule(
  'prune-expired-memory',
  '0 * * * *',
  $$ SELECT public.prune_expired_memory(); $$
);