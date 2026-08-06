CREATE TYPE public.review_rating AS ENUM ('again', 'hard', 'good', 'easy');

CREATE TABLE public.review_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('note', 'document', 'memory')),
  source_id uuid NOT NULL,
  front text NOT NULL,
  back text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'review', 'suspended')),
  ease_factor real NOT NULL DEFAULT 2.5,
  interval_days integer NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  due_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_cards TO authenticated;
GRANT ALL ON public.review_cards TO service_role;

ALTER TABLE public.review_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own review cards"
ON public.review_cards
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.review_cards(id) ON DELETE CASCADE,
  rating public.review_rating NOT NULL,
  old_interval integer,
  new_interval integer,
  old_ease_factor real,
  new_ease_factor real,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.review_logs TO authenticated;
GRANT ALL ON public.review_logs TO service_role;

ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own review logs"
ON public.review_logs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_review_cards_updated
BEFORE UPDATE ON public.review_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();