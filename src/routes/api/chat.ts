import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const Body = z.object({
  workspaceId: z.string().uuid(),
  question: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(20)
    .optional(),
});

/**
 * Streaming workspace chat. Grounds the answer in hybrid retrieval, streams
 * the assistant tokens as plain text, and ships the citations up front in a
 * base64 `x-citations` header so the UI can render sources immediately.
 */
export const Route = createFileRoute("/api/chat")({
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
          const sources = await hybridRetrieve(supabase, body.workspaceId, body.question, 6);

          const citationsHeader = Buffer.from(JSON.stringify(sources), "utf-8").toString("base64");
          const baseHeaders = {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "x-citations": citationsHeader,
          };

          if (sources.length === 0) {
            return new Response(
              "I couldn't find anything relevant in this workspace yet. Add notes, documents or memory — they're indexed automatically as you save them.",
              { headers: baseHeaders },
            );
          }

          const contextBlocks = sources
            .map((r, i) => `[${i + 1}] (${r.source_type}: ${r.source_title})\n${r.snippet}`)
            .join("\n\n");

          const system =
            "You are Interview Buddy, a workspace assistant. Answer using the provided context from the user's workspace. " +
            "Cite sources inline using bracket numbers like [1], [2] that match the context blocks. " +
            "If the context does not contain the answer, say so plainly and suggest what to add. Be concise and direct.";

          const messages = [
            { role: "system" as const, content: system },
            ...(body.history ?? []),
            {
              role: "user" as const,
              content: `Context:\n${contextBlocks}\n\nQuestion: ${body.question}`,
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
