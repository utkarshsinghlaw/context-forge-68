import { supabase } from "@/integrations/supabase/client";

export type WorkspaceStats = {
  notes: number;
  tasks: number;
  tasksDone: number;
  documents: number;
  memory: number;
  sessions: number;
  turns: number;
  chunks: number;
  cardsDue: number;
  cardsTotal: number;
  reviewsLast30: number;
  activity: { date: string; count: number }[];
};

async function countOf(
  table: "notes" | "tasks" | "documents" | "memory_entries" | "sessions" | "chunks" | "review_cards",
  workspaceId: string,
  extra?: (q: any) => any,
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId);
  if (extra) q = extra(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

function emptyDays(days: number) {
  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  return out;
}

export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  const since = new Date();
  since.setDate(since.getDate() - 29);
  const sinceIso = since.toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [
    notes,
    tasks,
    tasksDone,
    documents,
    memory,
    sessions,
    chunks,
    cardsTotal,
    cardsDue,
  ] = await Promise.all([
    countOf("notes", workspaceId),
    countOf("tasks", workspaceId),
    countOf("tasks", workspaceId, (q) => q.eq("done", true)),
    countOf("documents", workspaceId),
    countOf("memory_entries", workspaceId),
    countOf("sessions", workspaceId),
    countOf("chunks", workspaceId),
    countOf("review_cards", workspaceId),
    countOf("review_cards", workspaceId, (q) => q.lte("due_date", today)),
  ]);

  const sessionIds = (
    await supabase.from("sessions").select("id").eq("workspace_id", workspaceId)
  ).data?.map((s) => s.id) ?? [];

  let turns = 0;
  if (sessionIds.length) {
    const { count } = await supabase
      .from("session_turns")
      .select("id", { count: "exact", head: true })
      .in("session_id", sessionIds);
    turns = count ?? 0;
  }

  const cardIds = (
    await supabase.from("review_cards").select("id").eq("workspace_id", workspaceId)
  ).data?.map((c) => c.id) ?? [];
  let reviewsLast30 = 0;
  if (cardIds.length) {
    const { count } = await supabase
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .in("card_id", cardIds)
      .gte("created_at", sinceIso);
    reviewsLast30 = count ?? 0;
  }

  const buckets = new Map(emptyDays(30).map((d) => [d.date, 0]));
  const dated = await Promise.all([
    supabase.from("notes").select("created_at").eq("workspace_id", workspaceId).gte("created_at", sinceIso),
    supabase.from("tasks").select("created_at").eq("workspace_id", workspaceId).gte("created_at", sinceIso),
    supabase.from("documents").select("created_at").eq("workspace_id", workspaceId).gte("created_at", sinceIso),
    supabase.from("sessions").select("created_at").eq("workspace_id", workspaceId).gte("created_at", sinceIso),
  ]);
  for (const res of dated) {
    for (const row of res.data ?? []) {
      const key = String(row.created_at).slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return {
    notes,
    tasks,
    tasksDone,
    documents,
    memory,
    sessions,
    turns,
    chunks,
    cardsDue,
    cardsTotal,
    reviewsLast30,
    activity: [...buckets.entries()].map(([date, count]) => ({ date, count })),
  };
}
