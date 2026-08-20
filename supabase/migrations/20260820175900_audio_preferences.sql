-- Add audio source preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN default_audio_source text DEFAULT 'mic' CHECK (default_audio_source IN ('mic', 'system', 'both'));

-- Add auto start mic preference
ALTER TABLE public.profiles
ADD COLUMN auto_start_mic boolean DEFAULT false;
