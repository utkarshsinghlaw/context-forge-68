import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkText } from "@/lib/chunk";

/* ----------------------------- Reindex ----------------------------- */

const ReindexInput = z.object({ workspaceId: z.string().uuid() });

interface SourceRow {
  source_type: "note" | "document" | "memory";
  source_id: string;
  source_title: string;
  workspace_id: string | null;
  text: string;
}

export const reindexWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReindexInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { workspaceId } = data;
    const { embedTexts } = await import("@/lib/ai-gateway.server");

    const [notes, docs, wsMem, vaultMem] = await Promise.all([
      supabase.from("notes").select("id,title,content").eq("workspace_id", workspaceId),
      supabase.from("documents").select("id,title,content").eq("workspace_id", workspaceId),
      supabase.from("memory_entries").select("id,title,content").eq("workspace_id", workspaceId),
      supabase
        .from("memory_entries")
        .select("id,title,content")
        .eq("layer", "vault")
        .is("workspace_id", null),
    ]);

    const sources: SourceRow[] = [];
    for (const n of notes.data ?? [])
      sources.push({
        source_type: "note",
        source_id: n.id,
        source_title: n.title,
        workspace_id: workspaceId,
        text: `${n.title}\n\n${n.content ?? ""}`,
      });
    for (const d of docs.data ?? [])
      sources.push({
        source_type: "document",
        source_id: d.id,
        source_title: d.title,
        workspace_id: workspaceId,
        text: `${d.title}\n\n${d.content ?? ""}`,
      });
    for (const m of wsMem.data ?? [])
      sources.push({
        source_type: "memory",
        source_id: m.id,
        source_title: m.title,
        workspace_id: workspaceId,
        text: `${m.title}\n\n${m.content ?? ""}`,
      });
    for (const m of vaultMem.data ?? [])
      sources.push({
        source_type: "memory",
        source_id: m.id,
        source_title: m.title,
        workspace_id: null,
        text: `${m.title}\n\n${m.content ?? ""}`,
      });

    // Build chunk records.
    const pending: { meta: SourceRow; chunk_index: number; content: string }[] = [];
    for (const s of sources) {
      const parts = chunkText(s.text);
      parts.forEach((content, i) => pending.push({ meta: s, chunk_index: i, content }));
    }

    // Clear existing workspace + vault chunks for this user, then reinsert.
    await supabase
      .from("chunks")
      .delete()
      .eq("user_id", userId)
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);

    if (pending.length === 0) return { indexed: 0, sources: sources.length };

    // Embed in batches.
    const BATCH = 64;
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < pending.length; i += BATCH) {
      const slice = pending.slice(i, i + BATCH);
      const vectors = await embedTexts(slice.map((p) => p.content));
      slice.forEach((p, j) => {
        rows.push({
          user_id: userId,
          workspace_id: p.meta.workspace_id,
          source_type: p.meta.source_type,
          source_id: p.meta.source_id,
          source_title: p.meta.source_title,
          chunk_index: p.chunk_index,
          content: p.content,
          embedding: JSON.stringify(vectors[j]),
        });
      });
    }

    const { error } = await supabase.from("chunks").insert(rows as never);
    if (error) throw new Error(error.message);

    return { indexed: rows.length, sources: sources.length };
  });

/* ----------------------- Incremental indexing ----------------------- */

const SourceRef = z.object({
  sourceType: z.enum(["note", "document", "memory"]),
  sourceId: z.string().uuid(),
});

/**
 * Re-embed a single source (note / document / memory) and replace its chunks.
 * Called automatically after a create or update so retrieval stays live.
 */
export const indexSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SourceRef.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { sourceType, sourceId } = data;
    const { embedTexts } = await import("@/lib/ai-gateway.server");

    const table =
      sourceType === "note" ? "notes" : sourceType === "document" ? "documents" : "memory_entries";
    const { data: row } = await supabase
      .from(table)
      .select("id,title,content,workspace_id")
      .eq("id", sourceId)
      .maybeSingle();

    // Always clear stale chunks for this source first.
    await supabase
      .from("chunks")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId);

    if (!row) return { indexed: 0 };

    const title = (row as { title?: string }).title ?? "";
    const content = (row as { content?: string }).content ?? "";
    const workspace_id = (row as { workspace_id?: string | null }).workspace_id ?? null;
    const parts = chunkText(`${title}\n\n${content}`);
    if (parts.length === 0) return { indexed: 0 };

    const vectors = await embedTexts(parts);
    const rows = parts.map((c, i) => ({
      user_id: userId,
      workspace_id,
      source_type: sourceType,
      source_id: sourceId,
      source_title: title,
      chunk_index: i,
      content: c,
      embedding: JSON.stringify(vectors[i]),
    }));

    const { error } = await supabase.from("chunks").insert(rows as never);
    if (error) throw new Error(error.message);
    return { indexed: rows.length };
  });

/** Remove all chunks for a deleted source. */
export const removeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SourceRef.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("chunks")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", data.sourceType)
      .eq("source_id", data.sourceId);
    return { ok: true };
  });

/* ------------------------------- Ask ------------------------------- */

const AskInput = z.object({
  workspaceId: z.string().uuid(),
  question: z.string().min(1).max(2000),
});

export interface Citation {
  source_type: string;
  source_id: string;
  source_title: string;
  snippet: string;
  similarity: number;
}

export const askWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }): Promise<{ answer: string; citations: Citation[] }> => {
    const { supabase } = context;
    const { workspaceId, question } = data;
    const { embedOne, chatComplete } = await import("@/lib/ai-gateway.server");

    // 1. Vector retrieval.
    const qVec = await embedOne(question);
    const { data: vecMatches } = await supabase.rpc("match_chunks", {
      query_embedding: JSON.stringify(qVec) as never,
      p_workspace_id: workspaceId,
      match_count: 8,
    });

    // 2. Keyword retrieval (hybrid).
    const { data: kwMatches } = await supabase
      .from("chunks")
      .select("id,source_type,source_id,source_title,content")
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .textSearch("fts", question, { type: "websearch", config: "english" })
      .limit(6);

    // 3. Reciprocal-rank fusion merge.
    const scores = new Map<string, { row: Citation; score: number }>();
    // Key by source_id so repeated chunks of one source collapse to a single citation.
    const add = (id: string, row: Citation, rank: number) => {
      const prev = scores.get(id);
      const inc = 1 / (60 + rank);
      if (prev) {
        prev.score += inc;
        if (row.similarity > prev.row.similarity) prev.row = row;
      } else scores.set(id, { row, score: inc });
    };
    (vecMatches ?? []).forEach((m, i) =>
      add(
        m.source_id,
        {
          source_type: m.source_type,
          source_id: m.source_id,
          source_title: m.source_title,
          snippet: m.content.slice(0, 280),
          similarity: m.similarity ?? 0,
        },
        i,
      ),
    );
    (kwMatches ?? []).forEach((m, i) =>
      add(
        m.source_id,
        {
          source_type: m.source_type,
          source_id: m.source_id,
          source_title: m.source_title,
          snippet: m.content.slice(0, 280),
          similarity: 0,
        },
        i,
      ),
    );

    const ranked = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 6);

    if (ranked.length === 0) {
      return {
        answer:
          "I couldn't find anything relevant in this workspace yet. Add notes, documents or memory — they're indexed automatically as you save them.",
        citations: [],
      };
    }

    // 4. Build grounded context.
    const context_blocks = ranked
      .map((r, i) => `[${i + 1}] (${r.row.source_type}: ${r.row.source_title})\n${r.row.snippet}`)
      .join("\n\n");

    const system =
      "You are Interview Buddy, a workspace assistant. Answer ONLY using the provided context from the user's workspace. " +
      "Cite sources inline using bracket numbers like [1], [2] that match the context blocks. " +
      "If the context does not contain the answer, say so plainly and suggest what to add. Be concise and direct.";

    const answer = await chatComplete([
      { role: "system", content: system },
      { role: "user", content: `Context:\n${context_blocks}\n\nQuestion: ${question}` },
    ]);

    return { answer, citations: ranked.map((r) => r.row) };
  });
