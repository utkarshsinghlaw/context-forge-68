CREATE TABLE public.graph_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  type text not null default 'concept',
  description text not null default '',
  mentions integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE UNIQUE INDEX graph_entities_ws_name_uniq ON public.graph_entities (workspace_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.graph_entities TO authenticated;
GRANT ALL ON public.graph_entities TO service_role;
ALTER TABLE public.graph_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own graph entities" ON public.graph_entities FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_graph_entities_updated BEFORE UPDATE ON public.graph_entities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.graph_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_entity_id uuid not null references public.graph_entities(id) on delete cascade,
  target_entity_id uuid not null references public.graph_entities(id) on delete cascade,
  relation text not null,
  evidence text not null default '',
  created_at timestamptz not null default now()
);
CREATE UNIQUE INDEX graph_edges_uniq ON public.graph_edges (workspace_id, source_entity_id, target_entity_id, lower(relation));
CREATE INDEX graph_edges_ws_idx ON public.graph_edges (workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.graph_edges TO authenticated;
GRANT ALL ON public.graph_edges TO service_role;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own graph edges" ON public.graph_edges FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);