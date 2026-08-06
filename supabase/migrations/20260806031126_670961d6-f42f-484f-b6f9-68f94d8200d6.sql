REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Keep service_role able to call it for admin/backfill use.
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;