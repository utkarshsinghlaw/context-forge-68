import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* --------------------------- Transcription --------------------------- */

const TranscribeInput = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().min(1),
});

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
};

/** Transcribe a short audio clip via the Lovable AI gateway. Buffered (non-streaming). */
export const transcribeTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TranscribeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const { supabase, userId } = context;
    const { data: isAllowed, error: rlError } = await supabase.rpc("check_rate_limit", {
      p_user_id: userId,
      p_endpoint: "transcribeTurn",
      p_limit: 100,
      p_window_seconds: 3600
    });
    if (rlError) throw new Error(rlError.message);
    if (!isAllowed) throw new Error("Rate limit exceeded. Please try again later.");

    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Missing OPENAI_API_KEY");

    const base = data.mimeType.split(";")[0];
    const ext = EXT[base] ?? "webm";

    const bin = atob(data.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length < 1024) return { text: "" };

    const form = new FormData();
    // ADDED: Switched to OpenAI's Whisper model after removing Lovable AI proxy
    form.append("model", "whisper-1");
    form.append("file", new Blob([bytes], { type: base }), `recording.${ext}`);

    // ADDED: Using native OpenAI endpoint instead of Lovable proxy
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
      if (res.status === 429) throw new Error("AI is rate limited. Please try again in a moment.");
      throw new Error(`Transcription failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { text?: string };
    return { text: (json.text ?? "").trim() };
  });

/* ------------------------- Answer suggestion ------------------------- */

export interface SuggestCitation {
  source_type: string;
  source_id: string;
  source_title: string;
  snippet: string;
}

// Answer suggestions are now streamed via the `/api/session-suggest` route
// (see src/routes/api/session-suggest.ts) and persisted client-side once the
// stream completes, mirroring the streaming Ask panel.
