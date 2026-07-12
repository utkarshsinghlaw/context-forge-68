/**
 * Server-only hybrid retrieval helper shared by Ask AI and Live Session mode.
 * Combines semantic (vector) + keyword (full-text) search with reciprocal-rank
 * fusion. Never import from client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface RetrievedSource {
  source_type: string;
  source_id: string;
  source_title: string;
  snippet: string;
  similarity: number;
}

type DB = SupabaseClient<Database>;

export async function hybridRetrieve(
  supabase: DB,
  workspaceId: string,
  query: string,
  limit = 6,
): Promise<RetrievedSource[]> {
  const { embedOne } = await import("@/lib/ai-gateway.server");
  const qVec = await embedOne(query);

  const [{ data: vecMatches }, { data: kwMatches }] = await Promise.all([
    supabase.rpc("match_chunks", {
      query_embedding: JSON.stringify(qVec) as never,
      p_workspace_id: workspaceId,
      match_count: 8,
    }),
    supabase
      .from("chunks")
      .select("id,source_type,source_id,source_title,content")
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .textSearch("fts", query, { type: "websearch", config: "english" })
      .limit(6),
  ]);

  const scores = new Map<string, { row: RetrievedSource; score: number }>();
  // Key by source_id (not chunk id) so multiple chunks of the same note/doc
  // collapse into a single citation whose score is the fusion of its chunks.
  const add = (id: string, row: RetrievedSource, rank: number) => {
    const prev = scores.get(id);
    const inc = 1 / (60 + rank);
    if (prev) {
      prev.score += inc;
      if (row.similarity > prev.row.similarity) prev.row = row;
    }
    else scores.set(id, { row, score: inc });
  };

  (vecMatches ?? []).forEach((m, i) =>
    add(m.source_id, {
      source_type: m.source_type,
      source_id: m.source_id,
      source_title: m.source_title,
      snippet: m.content.slice(0, 280),
      similarity: m.similarity ?? 0,
    }, i),
  );
  (kwMatches ?? []).forEach((m, i) =>
    add(m.source_id, {
      source_type: m.source_type,
      source_id: m.source_id,
      source_title: m.source_title,
      snippet: m.content.slice(0, 280),
      similarity: 0,
    }, i),
  );

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.row);
}
