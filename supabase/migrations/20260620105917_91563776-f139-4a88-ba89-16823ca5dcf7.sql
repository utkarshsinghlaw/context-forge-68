-- Enums
CREATE TYPE public.session_status AS ENUM ('live', 'ended');
CREATE TYPE public.turn_role AS ENUM ('speaker', 'assistant', 'note');

-- Sessions: a live capture session inside a workspace
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Live session',
  status public.session_status NOT NULL DEFAULT 'live',
  summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON public.sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Session turns: transcript fragments, AI suggestions, and manual notes
CREATE TABLE public.session_turns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.turn_role NOT NULL,
  content text NOT NULL DEFAULT '',
  citations jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_turns TO authenticated;
GRANT ALL ON public.session_turns TO service_role;

ALTER TABLE public.session_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own session turns"
  ON public.session_turns FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX session_turns_session_idx ON public.session_turns (session_id, created_at);
CREATE INDEX sessions_workspace_idx ON public.sessions (workspace_id, started_at DESC);