-- Add working_memory to sessions
ALTER TABLE public.sessions
ADD COLUMN working_memory text;

COMMENT ON COLUMN public.sessions.working_memory IS 'Maintains a condensed state of the conversation to provide context to lightweight models without requiring the entire raw chat history.';
