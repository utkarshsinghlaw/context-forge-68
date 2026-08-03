import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WorkspaceInput = z.object({ workspaceId: z.string().uuid() });

const ENTITY_TYPES = ["person", "organization", "concept", "term", "event"] as const;

const ExtractionSchema = z.object({
  entities: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        type: z.string().min(1).max(40),
        description: z.string().max(400).default(""),
      }),
    )
    .default([]),
  relationships: z
    .array(
      z.object({
        source: z.string().min(1).max(120),
        target: z.string().min(1).max(120),
        relation: z.string().min(1).max(80),
        evidence: z.string().max(400).default(""),
      }),
    )
    .default([]),
});

export interface GraphEntity {
  id: string;
  name: string;
  type: string;
  description: string;
  mentions: number;
}

export interface GraphEdge {
  id: string;
  relation: string;
  evidence: string;
  source: GraphEntity;
  target: GraphEntity;
}

export interface WorkspaceGraph {
  entities: GraphEntity[];
  edges: GraphEdge[];
}

function normalizeType(raw: string): string {
  const t = raw.trim().toLowerCase();
  return (ENTITY_TYPES as readonly string[]).includes(t) ? t : "concept";
}

function firstJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The model did not return usable JSON.");
  return JSON.parse(body.slice(start, end + 1));
}

/** Read the stored graph for a workspace. */
export const getWorkspaceGraph = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WorkspaceInput.parse(input))
  .handler(async ({ data, context }): Promise<WorkspaceGraph> => {
    const { supabase } = context;
    const [{ data: entities }, { data: edges }] = await Promise.all([
      supabase
        .from("graph_entities")
        .select("id,name,type,description,mentions")
        .eq("workspace_id", data.workspaceId)
        .order("mentions", { ascending: false })
        .order("name"),
      supabase
        .from("graph_edges")
        .select("id,relation,evidence,source_entity_id,target_entity_id")
        .eq("workspace_id", data.workspaceId),
    ]);

    const list = (entities ?? []) as GraphEntity[];
    const byId = new Map(list.map((e) => [e.id, e]));
    const resolved: GraphEdge[] = [];
    for (const e of edges ?? []) {
      const source = byId.get(e.source_entity_id);
      const target = byId.get(e.target_entity_id);
      if (source && target) {
        resolved.push({ id: e.id, relation: e.relation, evidence: e.evidence, source, target });
      }
    }
    return { entities: list, edges: resolved };
  });

/**
 * Extract entities + relationships from everything indexed in a workspace and
 * replace the stored graph. Runs over the chunk store so it reuses whatever the
 * auto-indexer already normalized (notes, documents, memory, transcripts).
 */
export const extractWorkspaceGraph = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WorkspaceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { workspaceId } = data;
    const { chatComplete } = await import("@/lib/ai-gateway.server");

    const { data: chunks, error: chunkErr } = await supabase
      .from("chunks")
      .select("source_type,source_title,content")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(120);
    if (chunkErr) throw new Error(chunkErr.message);
    if (!chunks || chunks.length === 0) {
      return { entities: 0, edges: 0, empty: true as const };
    }

    // Cap the corpus so a large workspace still fits one request comfortably.
    let budget = 60_000;
    const blocks: string[] = [];
    for (const c of chunks) {
      const block = `(${c.source_type}: ${c.source_title})\n${c.content}`;
      if (block.length > budget) break;
      budget -= block.length;
      blocks.push(block);
    }

    const system =
      "You extract a knowledge graph from a professional's workspace content. " +
      "Return STRICT JSON only, no prose, matching: " +
      '{"entities":[{"name":string,"type":"person"|"organization"|"concept"|"term"|"event","description":string}],' +
      '"relationships":[{"source":string,"target":string,"relation":string,"evidence":string}]}. ' +
      "Use canonical, deduplicated entity names. Only include relationships where BOTH names appear in entities. " +
      "Keep descriptions under 200 characters and cap output at 40 entities and 60 relationships.";

    const raw = await chatComplete([
      { role: "system", content: system },
      { role: "user", content: `Workspace content:\n\n${blocks.join("\n\n---\n\n")}` },
    ]);

    const parsed = ExtractionSchema.parse(firstJsonObject(raw));

    // Deduplicate entities case-insensitively, counting mentions.
    const entityMap = new Map<string, { name: string; type: string; description: string; mentions: number }>();
    for (const e of parsed.entities.slice(0, 60)) {
      const key = e.name.trim().toLowerCase();
      if (!key) continue;
      const prev = entityMap.get(key);
      if (prev) {
        prev.mentions += 1;
        if (!prev.description && e.description) prev.description = e.description;
      } else {
        entityMap.set(key, {
          name: e.name.trim(),
          type: normalizeType(e.type),
          description: e.description ?? "",
          mentions: 1,
        });
      }
    }
    if (entityMap.size === 0) return { entities: 0, edges: 0, empty: false as const };

    // Replace the previous graph (edges cascade with entities).
    await supabase.from("graph_edges").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
    await supabase.from("graph_entities").delete().eq("workspace_id", workspaceId).eq("user_id", userId);

    const { data: inserted, error: insErr } = await supabase
      .from("graph_entities")
      .insert(
        [...entityMap.values()].map((e) => ({
          user_id: userId,
          workspace_id: workspaceId,
          name: e.name,
          type: e.type,
          description: e.description,
          mentions: e.mentions,
        })) as never,
      )
      .select("id,name");
    if (insErr) throw new Error(insErr.message);

    const idByName = new Map((inserted ?? []).map((e) => [e.name.toLowerCase(), e.id]));

    const seen = new Set<string>();
    const edgeRows: Record<string, unknown>[] = [];
    for (const r of parsed.relationships.slice(0, 120)) {
      const s = idByName.get(r.source.trim().toLowerCase());
      const t = idByName.get(r.target.trim().toLowerCase());
      if (!s || !t || s === t) continue;
      const key = `${s}|${t}|${r.relation.trim().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edgeRows.push({
        user_id: userId,
        workspace_id: workspaceId,
        source_entity_id: s,
        target_entity_id: t,
        relation: r.relation.trim(),
        evidence: r.evidence ?? "",
      });
    }

    if (edgeRows.length > 0) {
      const { error: edgeErr } = await supabase.from("graph_edges").insert(edgeRows as never);
      if (edgeErr) throw new Error(edgeErr.message);
    }

    return { entities: idByName.size, edges: edgeRows.length, empty: false as const };
  });
