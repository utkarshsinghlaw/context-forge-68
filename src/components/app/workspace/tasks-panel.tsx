import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listTasks, createTask, updateTask, deleteTask, type TaskPriority } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "text-[oklch(0.6_0.2_25)] bg-[oklch(0.95_0.03_25)] dark:bg-[oklch(0.33_0.06_25)]",
  medium: "text-[oklch(0.55_0.13_60)] bg-[oklch(0.95_0.05_80)] dark:bg-[oklch(0.34_0.06_70)]",
  low: "text-muted-foreground bg-muted",
};

export function TasksPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["tasks", workspaceId];
  const { data: tasks = [], isLoading } = useQuery({ queryKey: key, queryFn: () => listTasks(workspaceId) });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: () => createTask(workspaceId, { title: title.trim(), priority }),
    onSuccess: () => {
      setTitle("");
      invalidate();
    },
    onError: () => toast.error("Could not add task"),
  });

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="mx-auto max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
        className="flex gap-2"
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
        />
        <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!title.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>

      {isLoading ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <TaskList title={`To do · ${open.length}`} tasks={open} onChanged={invalidate} />
          {done.length > 0 && (
            <TaskList title={`Done · ${done.length}`} tasks={done} onChanged={invalidate} muted />
          )}
          {tasks.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No tasks yet. Add your first above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TaskList({
  title,
  tasks,
  onChanged,
  muted,
}: {
  title: string;
  tasks: Awaited<ReturnType<typeof listTasks>>;
  onChanged: () => void;
  muted?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-soft"
          >
            <Checkbox
              checked={t.done}
              onCheckedChange={async (c) => {
                await updateTask(t.id, { done: !!c });
                onChanged();
              }}
            />
            <span className={cn("flex-1 text-sm", muted && "text-muted-foreground line-through")}>
              {t.title}
            </span>
            {t.due_date && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(t.due_date), "MMM d")}
              </span>
            )}
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", PRIORITY_STYLE[t.priority])}>
              {t.priority}
            </span>
            <button
              onClick={async () => {
                await deleteTask(t.id);
                onChanged();
              }}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Delete task"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}