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
  .handler(async ({ data }): Promise<{ text: string }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const base = data.mimeType.split(";")[0];
    const ext = EXT[base] ?? "webm";

    const bin = atob(data.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length < 1024) return { text: "" };

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: base }), `recording.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
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

const SuggestInput = z.object({
  sessionId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
});

export interface SuggestCitation {
  source_type: string;
  source_id: string;
  source_title: string;
  snippet: string;
}

/**
 * Generate a grounded answer suggestion for a live session and persist it as an
 * assistant turn. Retrieval-augmented over the workspace memory + documents.
 */
export const suggestAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SuggestInput.parse(input))
  .handler(async ({ data, context }): Promise<{ turnId: string; answer: string; citations: SuggestCitation[] }> => {
    const { supabase, userId } = context;
    const { hybridRetrieve } = await import("@/lib/retrieval.server");
    const { chatComplete } = await import("@/lib/ai-gateway.server");

    const ranked = await hybridRetrieve(supabase, data.workspaceId, data.prompt, 6);

    const citations: SuggestCitation[] = ranked.map((r) => ({
      source_type: r.source_type,
      source_id: r.source_id,
      source_title: r.source_title,
      snippet: r.snippet,
    }));

    const contextBlocks = ranked.length
      ? ranked.map((r, i) => `[${i + 1}] (${r.source_type}: ${r.source_title})\n${r.snippet}`).join("\n\n")
      : "(no workspace context found)";

    const system =
      "You are Interview Buddy, a real-time assistant during a live conversation or interview. " +
      "Draft a concise, confident answer the user can say out loud. Ground it in the provided workspace context and cite sources inline with bracket numbers like [1]. " +
      "If the context is thin, still give a strong general answer but be honest about gaps. Keep it under 120 words and speakable.";

    const answer = await chatComplete([
      { role: "system", content: system },
      { role: "user", content: `Workspace context:\n${contextBlocks}\n\nThey just said / asked:\n${data.prompt}\n\nDraft my answer:` },
    ]);

    const { data: turn, error } = await supabase
      .from("session_turns")
      .insert({
        session_id: data.sessionId,
        user_id: userId,
        role: "assistant",
        content: answer,
        citations: citations as never,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { turnId: turn.id, answer, citations };
  });
