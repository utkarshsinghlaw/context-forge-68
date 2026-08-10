import { supabase } from "@/integrations/supabase/client";
import type { Task, Note, Session, Workspace } from "@/lib/api";

export type TodayData = {
  workspaces: Workspace[];
  dueTasks: Task[];
  liveSessions: Session[];
  recentNotes: Note[];
  dueCards: number;
  newCards: number;
};

export async function getTodayData(): Promise<TodayData> {
  const today = new Date().toISOString().slice(0, 10);

  const [wsRes, taskRes, sessionRes, noteRes, dueRes, newRes] = await Promise.all([
    supabase.from("workspaces").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("done", false)
      .not("due_date", "is", null)
      .lte("due_date", today)
      .order("due_date", { ascending: true })
      .limit(25),
    supabase
      .from("sessions")
      .select("*")
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(10),
    supabase.from("notes").select("*").order("updated_at", { ascending: false }).limit(6),
    supabase
      .from("review_cards")
      .select("id", { count: "exact", head: true })
      .lte("due_date", today),
    supabase
      .from("review_cards")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  const err =
    wsRes.error || taskRes.error || sessionRes.error || noteRes.error || dueRes.error || newRes.error;
  if (err) throw err;

  return {
    workspaces: wsRes.data ?? [],
    dueTasks: taskRes.data ?? [],
    liveSessions: sessionRes.data ?? [],
    recentNotes: noteRes.data ?? [],
    dueCards: dueRes.count ?? 0,
    newCards: newRes.count ?? 0,
  };
}
