import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listWorkspaces,
  createWorkspace,
  type WorkspaceKind,
} from "@/lib/api";
import {
  WORKSPACE_KINDS,
  WORKSPACE_COLOR_KEYS,
  kindMeta,
  colorMeta,
} from "@/lib/workspace-meta";
import { useRegisterCommands } from "@/components/app/command-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/home")({
  validateSearch: (s: Record<string, unknown>): { new?: boolean } =>
    s.new === true || s.new === "true" ? { new: true } : {},
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { new: openNew } = Route.useSearch();
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (openNew) {
      setDialogOpen(true);
      navigate({ to: "/home", search: { new: false }, replace: true });
    }
  }, [openNew, navigate]);

  useRegisterCommands(
    [
      {
        id: "new-workspace",
        label: "Create new workspace",
        group: "Actions",
        icon: Plus,
        run: () => setDialogOpen(true),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-1 text-muted-foreground">
            Every project lives in its own focused workspace.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> New workspace
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState onCreate={() => setDialogOpen(true)} />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => {
            const meta = kindMeta(w.kind);
            const color = colorMeta(w.color);
            const Icon = meta.icon;
            return (
              <button
                key={w.id}
                onClick={() => navigate({ to: "/w/$workspaceId", params: { workspaceId: w.id } })}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="flex items-center justify-between">
                  <span className={cn("grid h-11 w-11 place-items-center rounded-xl", color.soft, color.text)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
                <h3 className="mt-4 font-semibold">{w.name}</h3>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {meta.label}
                </p>
                {w.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{w.description}</p>
                )}
                <p className="mt-auto pt-4 text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(w.updated_at), { addSuffix: true })}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <NewWorkspaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <h3 className="text-lg font-semibold">Create your first workspace</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Workspaces hold your notes, tasks, documents and memory. Try “Leeds MBA”,
        “Bain Recruiting” or “Commercial Arbitration”.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus className="h-4 w-4" /> New workspace
      </Button>
    </div>
  );
}

function NewWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WorkspaceKind>("mba");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createWorkspace({ name: name.trim(), kind, color, icon: "folder", description: description.trim() || null }),
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace created");
      onOpenChange(false);
      setName("");
      setDescription("");
      navigate({ to: "/w/$workspaceId", params: { workspaceId: w.id } });
    },
    onError: () => toast.error("Could not create workspace"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>Give it a name and choose a type.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Leeds MBA"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {WORKSPACE_KINDS.map((k) => {
                const Icon = k.icon;
                return (
                  <button
                    key={k.kind}
                    type="button"
                    onClick={() => setKind(k.kind)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      kind === k.kind
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border hover:bg-accent/40",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{k.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Accent</Label>
            <div className="flex gap-2">
              {WORKSPACE_COLOR_KEYS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={cn(
                    "h-7 w-7 rounded-full ring-offset-2 ring-offset-background transition-all",
                    colorMeta(c).dot,
                    color === c ? "ring-2 ring-ring" : "",
                  )}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-desc">Description (optional)</Label>
            <Textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}