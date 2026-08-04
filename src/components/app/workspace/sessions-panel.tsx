import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listSessions, createSession, deleteSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mic, Plus, Trash2, Loader2, Radio, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { PanelEmpty } from "./panel-empty";

export function SessionsPanel({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = ["sessions", workspaceId];
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listSessions(workspaceId),
  });

  const start = useMutation({
    mutationFn: () => createSession(workspaceId),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: key });
      navigate({ to: "/session/$sessionId", params: { sessionId: s.id } });
    },
    onError: () => toast.error("Couldn't start a session"),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Capture live conversations and get grounded, speakable answers in real time.
        </p>
        <Button onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Start live session
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-6">
          <PanelEmpty
            icon={Mic}
            title="No sessions yet"
            body="Start a live session before an interview or call. Interview Buddy listens, then drafts answers grounded in this workspace."
            action={
              <Button onClick={() => start.mutate()}>
                <Plus className="h-4 w-4" /> Start live session
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate({ to: "/session/$sessionId", params: { sessionId: s.id } })}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Mic className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(s.started_at), { addSuffix: true })}
                  {s.summary ? ` · ${s.summary.slice(0, 80)}` : ""}
                </p>
              </div>
              {s.status === "ended" ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ended
                </Badge>
              ) : (
                <Badge className="gap-1 bg-destructive text-destructive-foreground">
                  <Radio className="h-3 w-3 animate-pulse" /> Live
                </Badge>
              )}
              <span
                role="button"
                tabIndex={0}
                onClick={async (e) => {
                  e.stopPropagation();
                  await deleteSession(s.id);
                  qc.invalidateQueries({ queryKey: key });
                }}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete session"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
