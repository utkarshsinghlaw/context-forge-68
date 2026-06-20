import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getWorkspace, deleteWorkspace, createNote, createSession } from "@/lib/api";
import { kindMeta, colorMeta } from "@/lib/workspace-meta";
import { useRegisterCommands } from "@/components/app/command-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OverviewPanel } from "@/components/app/workspace/overview-panel";
import { NotesPanel } from "@/components/app/workspace/notes-panel";
import { TasksPanel } from "@/components/app/workspace/tasks-panel";
import { DocumentsPanel } from "@/components/app/workspace/documents-panel";
import { MemoryPanel } from "@/components/app/workspace/memory-panel";
import { AskPanel } from "@/components/app/workspace/ask-panel";
import { SessionsPanel } from "@/components/app/workspace/sessions-panel";
import { MoreHorizontal, Trash2, Loader2, StickyNote, CheckSquare, Sparkles, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/w/$workspaceId")({
  component: WorkspacePage,
});

const TABS = ["overview", "live", "ask", "notes", "tasks", "documents", "memory"] as const;

function WorkspacePage() {
  const { workspaceId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: workspace, isLoading, isError } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => getWorkspace(workspaceId),
  });

  const del = useMutation({
    mutationFn: () => deleteWorkspace(workspaceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace deleted");
      navigate({ to: "/home" });
    },
  });

  useRegisterCommands(
    [
      {
        id: "ws-new-note",
        label: "New note in this workspace",
        group: "This workspace",
        icon: StickyNote,
        run: async () => {
          await createNote(workspaceId);
          qc.invalidateQueries({ queryKey: ["notes", workspaceId] });
          setTab("notes");
        },
      },
      {
        id: "ws-go-tasks",
        label: "Open tasks",
        group: "This workspace",
        icon: CheckSquare,
        run: () => setTab("tasks"),
      },
      {
        id: "ws-ask-ai",
        label: "Ask AI about this workspace",
        group: "This workspace",
        icon: Sparkles,
        run: () => setTab("ask"),
      },
      {
        id: "ws-live-session",
        label: "Start live session",
        group: "This workspace",
        icon: Mic,
        run: async () => {
          const s = await createSession(workspaceId);
          qc.invalidateQueries({ queryKey: ["sessions", workspaceId] });
          navigate({ to: "/session/$sessionId", params: { sessionId: s.id } });
        },
      },
    ],
    [workspaceId],
  );

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !workspace) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h2 className="text-lg font-semibold">Workspace not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted.</p>
        <Button className="mt-6" onClick={() => navigate({ to: "/home" })}>
          Back to workspaces
        </Button>
      </div>
    );
  }

  const meta = kindMeta(workspace.kind);
  const color = colorMeta(workspace.color);
  const Icon = meta.icon;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", color.soft, color.text)}>
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {meta.label}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Delete workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewPanel workspace={workspace} onTab={setTab} />
        </TabsContent>
        <TabsContent value="live" className="mt-6">
          <SessionsPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="ask" className="mt-6">
          <AskPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="notes" className="mt-6">
          <NotesPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-6">
          <TasksPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <DocumentsPanel workspaceId={workspaceId} />
        </TabsContent>
        <TabsContent value="memory" className="mt-6">
          <MemoryPanel workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{workspace.name}” and all its notes, tasks,
              documents and memory. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => del.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}