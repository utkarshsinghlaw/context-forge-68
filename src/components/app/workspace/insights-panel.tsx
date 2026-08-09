import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, StickyNote, CheckSquare, FileText, Brain, Mic, Layers } from "lucide-react";
import { getWorkspaceStats } from "@/lib/analytics";
import { Progress } from "@/components/ui/progress";

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof StickyNote;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function InsightsPanel({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["stats", workspaceId],
    queryFn: () => getWorkspaceStats(workspaceId),
  });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completion = data.tasks ? Math.round((data.tasksDone / data.tasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={StickyNote} label="Notes" value={data.notes} />
        <Stat icon={FileText} label="Documents" value={data.documents} />
        <Stat icon={Brain} label="Memory entries" value={data.memory} />
        <Stat icon={Mic} label="Sessions" value={data.sessions} hint={`${data.turns} turns captured`} />
        <Stat icon={Layers} label="Indexed chunks" value={data.chunks} hint="Searchable by AI" />
        <Stat
          icon={CheckSquare}
          label="Review cards"
          value={data.cardsTotal}
          hint={`${data.cardsDue} due · ${data.reviewsLast30} reviews in 30d`}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Task completion</h3>
          <span className="text-sm tabular-nums text-muted-foreground">
            {data.tasksDone}/{data.tasks} · {completion}%
          </span>
        </div>
        <Progress value={completion} className="mt-3" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Activity — last 30 days</h3>
        <p className="text-xs text-muted-foreground">Notes, tasks, documents and sessions created</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.activity} margin={{ left: -24, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => v.slice(5)}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                className="text-xs fill-muted-foreground"
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} className="text-xs fill-muted-foreground" />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#activityFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
