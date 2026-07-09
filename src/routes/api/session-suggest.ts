import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const Body = z.object({
  workspaceId: z.string().uuid(),
  prompt: z.string().min(1).max(4000),
});

/**
 * Streaming live-session answer suggestion. Grounds a short, speakable answer
 * in hybrid retrieval, streams the tokens as plain text, and ships citations
 * up front in a base64 `x-citations` header. Persistence is done by the client
 * once the stream completes (Workers tear the request down on disconnect).
 */
export const Route = createFileRoute("/api/session-suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: authError } = await supabase.auth.getClaims(token);
        if (authError || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        try {
          const { hybridRetrieve } = await import("@/lib/retrieval.server");
          const sources = await hybridRetrieve(supabase, body.workspaceId, body.prompt, 6);

          const citationsHeader = Buffer.from(JSON.stringify(sources), "utf-8").toString("base64");
          const baseHeaders = {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "x-citations": citationsHeader,
          };

          const contextBlocks = sources.length
            ? sources
                .map((r, i) => `[${i + 1}] (${r.source_type}: ${r.source_title})\n${r.snippet}`)
                .join("\n\n")
            : "(no workspace context found)";

          const system =
            "You are Interview Buddy, a real-time assistant during a live conversation or interview. " +
            "Draft a concise, confident answer the user can say out loud. Ground it in the provided workspace context and cite sources inline with bracket numbers like [1]. " +
            "If the context is thin, still give a strong general answer but be honest about gaps. Keep it under 120 words and speakable.";

          const messages = [
            { role: "system" as const, content: system },
            {
              role: "user" as const,
              content: `Workspace context:\n${contextBlocks}\n\nThey just said / asked:\n${body.prompt}\n\nDraft my answer:`,
            },
          ];

          const { openChatStream, sseToTextStream } = await import("@/lib/ai-gateway.server");
          const upstream = await openChatStream(messages);
          return new Response(sseToTextStream(upstream), { headers: baseHeaders });
        } catch (e) {
          const status =
            e != null && typeof e === "object" && "status" in e
              ? ((e as { status: number }).status ?? 500)
              : 500;
          const message = e instanceof Error ? e.message : "AI request failed";
          return new Response(message, { status });
        }
      },
    },
  },
});
