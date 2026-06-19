import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Workspace = Tables<"workspaces">;
export type Note = Tables<"notes">;
export type Task = Tables<"tasks">;
export type Document = Tables<"documents">;
export type MemoryEntry = Tables<"memory_entries">;
export type WorkspaceKind = Workspace["kind"];
export type MemoryLayer = MemoryEntry["layer"];
export type TaskPriority = Task["priority"];

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/* ---------- Workspaces ---------- */
export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getWorkspace(id: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createWorkspace(
  input: Pick<TablesInsert<"workspaces">, "name" | "kind" | "icon" | "color" | "description">,
): Promise<Workspace> {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ ...input, user_id: await uid() })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorkspace(id: string, patch: TablesUpdate<"workspaces">) {
  const { error } = await supabase.from("workspaces").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkspace(id: string) {
  const { error } = await supabase.from("workspaces").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Notes ---------- */
export async function listNotes(workspaceId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createNote(workspaceId: string, title = "Untitled", content = "") {
  const { data, error } = await supabase
    .from("notes")
    .insert({ workspace_id: workspaceId, user_id: await uid(), title, content })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, patch: TablesUpdate<"notes">) {
  const { error } = await supabase.from("notes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteNote(id: string) {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Tasks ---------- */
export async function listTasks(workspaceId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTask(
  workspaceId: string,
  input: { title: string; priority?: TaskPriority; due_date?: string | null },
) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      workspace_id: workspaceId,
      user_id: await uid(),
      title: input.title,
      priority: input.priority ?? "medium",
      due_date: input.due_date ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(id: string, patch: TablesUpdate<"tasks">) {
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Documents ---------- */
export async function listDocuments(workspaceId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createDocument(
  workspaceId: string,
  input: { title: string; content?: string; file_type?: string },
) {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: workspaceId,
      user_id: await uid(),
      title: input.title,
      content: input.content ?? "",
      file_type: input.file_type ?? "text",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(id: string) {
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Memory ---------- */
export async function listMemory(opts: {
  layer: MemoryLayer;
  workspaceId?: string | null;
}): Promise<MemoryEntry[]> {
  let q = supabase.from("memory_entries").select("*").eq("layer", opts.layer);
  if (opts.layer === "vault") {
    q = q.is("workspace_id", null);
  } else if (opts.workspaceId) {
    q = q.eq("workspace_id", opts.workspaceId);
  }
  const { data, error } = await q.order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMemory(input: {
  layer: MemoryLayer;
  workspaceId?: string | null;
  title: string;
  content?: string;
  category?: string | null;
}) {
  const expires =
    input.layer === "working"
      ? new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString()
      : null;
  const { data, error } = await supabase
    .from("memory_entries")
    .insert({
      user_id: await uid(),
      layer: input.layer,
      workspace_id: input.layer === "vault" ? null : (input.workspaceId ?? null),
      title: input.title,
      content: input.content ?? "",
      category: input.category ?? null,
      expires_at: expires,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMemory(id: string) {
  const { error } = await supabase.from("memory_entries").delete().eq("id", id);
  if (error) throw error;
}