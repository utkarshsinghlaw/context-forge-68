import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { getTodayData } from "@/lib/today";
import { updateTask } from "@/lib/api";
import { kindMeta, colorMeta } from "@/lib/workspace-meta";
import { useRegisterCommands } from "@/components/app/command-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarCheck, Loader2, Brain, Mic, StickyNote, ArrowRight, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — Interview Buddy" },
      {
        name: "description",
        content:
          "Your daily briefing: tasks due, review cards waiting, live sessions and recent notes across every workspace.",
      },
      { property: "og:title", content: "Today — Interview Buddy" },
      {
        property: "og:description",
        content: "Daily briefing across all your Interview Buddy workspaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TodayPage,
});

function Section({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Sun;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function TodayPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["today"], queryFn: getTodayData });

  useRegisterCommands(
    [
      {
        id: "go-today",
        label: "Open Today briefing",
        group: "Navigate",
        icon: CalendarCheck,
        run: () => navigate({ to: "/today" }),
      },
    ],
    [],
  );

  if (isLoading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const wsById = new Map(data.workspaces.map((w) => [w.id, w]));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  async function toggleTask(id: string, done: boolean) {
    await updateTask(id, { done });
    qc.invalidateQueries({ queryKey: ["today"] });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.dueTasks.length} task{data.dueTasks.length === 1 ? "" : "s"} due ·{" "}
        {data.dueCards} card{data.dueCards === 1 ? "" : "s"} to review ·{" "}
        {data.liveSessions.length} live session{data.liveSessions.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section icon={CalendarCheck} title="Due & overdue tasks">
          {data.dueTasks.length === 0 ? (
            <Empty>Nothing due today. Enjoy the clear runway.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.dueTasks.map((t) => {
                const ws = wsById.get(t.workspace_id);
                const overdue = t.due_date! < new Date().toISOString().slice(0, 10);
                return (
                  <li key={t.id} className="flex items-start gap-3">
                    <Checkbox
                      checked={t.done}
                      onCheckedChange={(v) => toggleTask(t.id, v === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ws?.name ?? "Workspace"} · {overdue ? "overdue" : "today"}
                      </p>
                    </div>
                    <Badge variant={t.priority === "high" ? "default" : "secondary"}>
                      {t.priority}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section icon={Brain} title="Review queue">
          <p className="text-3xl font-semibold tabular-nums">{data.dueCards}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            cards due · {data.newCards} new awaiting first pass
          </p>
          {data.workspaces.length > 0 && (
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() =>
                navigate({
                  to: "/w/$workspaceId",
                  params: { workspaceId: data.workspaces[0].id },
                  search: { tab: "review" },
                })
              }
            >
              Start reviewing <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </Section>

        <Section icon={Mic} title="Live sessions">
          {data.liveSessions.length === 0 ? (
            <Empty>No sessions in progress.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.liveSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    to="/session/$sessionId"
                    params={{ sessionId: s.id }}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
                  >
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                    <span className="truncate">{s.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(s.started_at), { addSuffix: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={StickyNote} title="Recently edited notes">
          {data.recentNotes.length === 0 ? (
            <Empty>No notes yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.recentNotes.map((n) => {
                const ws = wsById.get(n.workspace_id);
                const color = ws ? colorMeta(ws.color) : null;
                const Icon = ws ? kindMeta(ws.kind).icon : StickyNote;
                return (
                  <li key={n.id}>
                    <Link
                      to="/w/$workspaceId"
                      params={{ workspaceId: n.workspace_id }}
                      search={{ tab: "notes" }}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/50"
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", color?.text)} />
                      <span className="truncate">{n.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(n.updated_at), { addSuffix: true })}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
