import { supabase } from "@/integrations/supabase/client";
import {
  getWorkspace,
  listNotes,
  listTasks,
  listDocuments,
  listMemory,
  listSessions,
  type Workspace,
  type Note,
  type Task,
  type Document,
  type MemoryEntry,
  type Session,
  type SessionTurn,
} from "@/lib/api";

export type WorkspaceExport = {
  format: "interview-buddy/workspace-export";
  version: 1;
  exportedAt: string;
  workspace: Workspace;
  notes: Note[];
  tasks: Task[];
  documents: Document[];
  memory: { working: MemoryEntry[]; workspace: MemoryEntry[] };
  sessions: (Session & { turns: SessionTurn[] })[];
};

async function listTurnsForSessions(sessionIds: string[]): Promise<Map<string, SessionTurn[]>> {
  const map = new Map<string, SessionTurn[]>();
  if (sessionIds.length === 0) return map;
  const { data, error } = await supabase
    .from("session_turns")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  for (const turn of data) {
    const list = map.get(turn.session_id) ?? [];
    list.push(turn);
    map.set(turn.session_id, list);
  }
  return map;
}

export async function collectWorkspaceExport(workspaceId: string): Promise<WorkspaceExport> {
  const [workspace, notes, tasks, documents, working, wsMemory, sessions] = await Promise.all([
    getWorkspace(workspaceId),
    listNotes(workspaceId),
    listTasks(workspaceId),
    listDocuments(workspaceId),
    listMemory({ layer: "working", workspaceId }),
    listMemory({ layer: "workspace", workspaceId }),
    listSessions(workspaceId),
  ]);
  const turnsBySession = await listTurnsForSessions(sessions.map((s) => s.id));
  return {
    format: "interview-buddy/workspace-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace,
    notes,
    tasks,
    documents,
    memory: { working, workspace: wsMemory },
    sessions: sessions.map((s) => ({ ...s, turns: turnsBySession.get(s.id) ?? [] })),
  };
}

/** Strip HTML from rich-text note content so Markdown export stays readable. */
function htmlToText(html: string): string {
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function exportToMarkdown(data: WorkspaceExport): string {
  const out: string[] = [];
  out.push(`# ${data.workspace.name}`);
  if (data.workspace.description) out.push(data.workspace.description);
  out.push(
    `_Kind: ${data.workspace.kind} · Exported ${new Date(data.exportedAt).toLocaleString()}_`,
  );

  out.push(`\n## Notes (${data.notes.length})`);
  if (data.notes.length === 0) out.push("_None_");
  for (const n of data.notes) {
    out.push(`\n### ${n.title}${n.pinned ? " 📌" : ""}`);
    out.push(`_Updated ${fmtDate(n.updated_at)}_`);
    out.push(htmlToText(n.content) || "_Empty_");
  }

  out.push(`\n## Tasks (${data.tasks.length})`);
  if (data.tasks.length === 0) out.push("_None_");
  for (const t of data.tasks) {
    out.push(
      `- [${t.done ? "x" : " "}] ${t.title} — ${t.priority}${t.due_date ? ` · due ${t.due_date}` : ""}`,
    );
  }

  out.push(`\n## Documents (${data.documents.length})`);
  if (data.documents.length === 0) out.push("_None_");
  for (const d of data.documents) {
    out.push(`\n### ${d.title}`);
    out.push(`_${d.file_type} · added ${fmtDate(d.created_at)}_`);
    out.push(d.content || "_Empty_");
  }

  const memory = [...data.memory.workspace, ...data.memory.working];
  out.push(`\n## Memory (${memory.length})`);
  if (memory.length === 0) out.push("_None_");
  for (const m of memory) {
    out.push(`\n### ${m.title}`);
    out.push(`_${m.layer}${m.category ? ` · ${m.category}` : ""}_`);
    out.push(m.content || "_Empty_");
  }

  out.push(`\n## Sessions (${data.sessions.length})`);
  if (data.sessions.length === 0) out.push("_None_");
  for (const s of data.sessions) {
    out.push(`\n### ${s.title}`);
    out.push(`_${s.status} · started ${fmtDate(s.started_at)}_`);
    if (s.summary) out.push(`**Summary:** ${s.summary}`);
    for (const turn of s.turns) {
      out.push(`- **${turn.role}:** ${turn.content}`);
    }
  }

  return out.join("\n") + "\n";
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "workspace"
  );
}

export function downloadFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportWorkspace(workspaceId: string, format: "json" | "markdown") {
  const data = await collectWorkspaceExport(workspaceId);
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${slugify(data.workspace.name)}-${stamp}`;
  if (format === "json") {
    downloadFile(`${base}.json`, JSON.stringify(data, null, 2), "application/json");
  } else {
    downloadFile(`${base}.md`, exportToMarkdown(data), "text/markdown");
  }
  return data;
}