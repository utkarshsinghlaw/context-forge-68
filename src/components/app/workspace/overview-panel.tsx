import { useQuery } from "@tanstack/react-query";
import { listNotes, listTasks, listDocuments, listMemory, type Workspace } from "@/lib/api";
import { StickyNote, CheckSquare, FileText, Brain } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function OverviewPanel({
  workspace,
  onTab,
}: {
  workspace: Workspace;
  onTab: (tab: string) => void;
}) {
  const id = workspace.id;
  const notes = useQuery({ queryKey: ["notes", id], queryFn: () => listNotes(id) });
  const tasks = useQuery({ queryKey: ["tasks", id], queryFn: () => listTasks(id) });
  const docs = useQuery({ queryKey: ["documents", id], queryFn: () => listDocuments(id) });
  const wsMem = useQuery({
    queryKey: ["memory", "workspace", id],
    queryFn: () => listMemory({ layer: "workspace", workspaceId: id }),
  });

  const openTasks = (tasks.data ?? []).filter((t) => !t.done);

  const stats = [
    { label: "Notes", value: notes.data?.length ?? 0, icon: StickyNote, tab: "notes" },
    { label: "Open tasks", value: openTasks.length, icon: CheckSquare, tab: "tasks" },
    { label: "Documents", value: docs.data?.length ?? 0, icon: FileText, tab: "documents" },
    { label: "Memory", value: wsMem.data?.length ?? 0, icon: Brain, tab: "memory" },
  ];

  return (
    <div className="space-y-6">
      {workspace.description && (
        <p className="max-w-2xl text-muted-foreground">{workspace.description}</p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => onTab(s.tab)}
            className="rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
              <s.icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Recent notes</h3>
            <button onClick={() => onTab("notes")} className="text-sm text-primary hover:underline">
              View all
            </button>
          </div>
          {(notes.data ?? []).slice(0, 4).length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {(notes.data ?? []).slice(0, 4).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{n.title || "Untitled"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Up next</h3>
            <button onClick={() => onTab("tasks")} className="text-sm text-primary hover:underline">
              View all
            </button>
          </div>
          {openTasks.slice(0, 4).length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No open tasks.</p>
          ) : (
            <ul className="space-y-2">
              {openTasks.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="truncate">{t.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
