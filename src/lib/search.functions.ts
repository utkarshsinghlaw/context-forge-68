import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SearchInput = z.object({ query: z.string().min(1).max(500) });

export interface GlobalSearchResult {
  source_type: string;
  source_id: string;
  source_title: string;
  snippet: string;
  similarity: number;
  workspace_id: string | null;
  workspace_name: string;
}

/**
 * Global hybrid search across every workspace the user owns. Combines semantic
 * (vector) + keyword (full-text) retrieval with reciprocal-rank fusion, then
 * resolves each hit's workspace name. Vault entries (workspace_id null) are
 * grouped under "Knowledge Vault".
 */
export const globalSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data, context }): Promise<GlobalSearchResult[]> => {
    const { supabase } = context;
    const { query } = data;
    const { embedOne } = await import("@/lib/ai-gateway.server");

    const qVec = await embedOne(query);

    const [{ data: vecMatches }, { data: kwMatches }, { data: workspaces }] = await Promise.all([
      supabase.rpc("match_chunks_global", {
        query_embedding: JSON.stringify(qVec) as never,
        match_count: 16,
      }),
      supabase
        .from("chunks")
        .select("id,workspace_id,source_type,source_id,source_title,content")
        .textSearch("fts", query, { type: "websearch", config: "english" })
        .limit(12),
      supabase.from("workspaces").select("id,name"),
    ]);

    const wsName = new Map<string, string>();
    for (const w of workspaces ?? []) wsName.set(w.id, w.name);
    const nameFor = (id: string | null) => (id ? wsName.get(id) ?? "Workspace" : "Knowledge Vault");

    type Row = Omit<GlobalSearchResult, "workspace_name">;
    const scores = new Map<string, { row: Row; score: number }>();
    const add = (id: string, row: Row, rank: number) => {
      const prev = scores.get(id);
      const inc = 1 / (60 + rank);
      if (prev) prev.score += inc;
      else scores.set(id, { row, score: inc });
    };

    (vecMatches ?? []).forEach((m, i) =>
      add(m.id, {
        source_type: m.source_type,
        source_id: m.source_id,
        source_title: m.source_title,
        snippet: m.content.slice(0, 240),
        similarity: m.similarity ?? 0,
        workspace_id: m.workspace_id,
      }, i),
    );
    (kwMatches ?? []).forEach((m, i) =>
      add(m.id, {
        source_type: m.source_type,
        source_id: m.source_id,
        source_title: m.source_title,
        snippet: m.content.slice(0, 240),
        similarity: 0,
        workspace_id: m.workspace_id,
      }, i),
    );

    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => ({ ...r.row, workspace_name: nameFor(r.row.workspace_id) }));
  });
