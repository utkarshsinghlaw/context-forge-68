CREATE OR REPLACE FUNCTION public.prune_expired_memory()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.chunks c
  USING public.memory_entries m
  WHERE c.source_type = 'memory'
    AND c.source_id = m.id
    AND m.expires_at IS NOT NULL
    AND m.expires_at < now();

  DELETE FROM public.memory_entries
  WHERE expires_at IS NOT NULL
    AND expires_at < now();
END;
$$;

REVOKE ALL ON FUNCTION public.prune_expired_memory() FROM PUBLIC, anon, authenticated;