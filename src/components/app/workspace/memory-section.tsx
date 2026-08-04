import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listMemory, createMemory, deleteMemory, type MemoryLayer } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, type LucideIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export function MemorySection({
  layer,
  workspaceId,
  title,
  description,
  icon: Icon,
  accentClass,
}: {
  layer: MemoryLayer;
  workspaceId?: string | null;
  title: string;
  description: string;
  icon: LucideIcon;
  accentClass?: string;
}) {
  const qc = useQueryClient();
  const key = ["memory", layer, workspaceId ?? "global"];
  const { data: entries = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listMemory({ layer, workspaceId }),
  });
  const [open, setOpen] = useState(false);
  const [title2, setTitle2] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");

  const add = useMutation({
    mutationFn: () =>
      createMemory({
        layer,
        workspaceId,
        title: title2.trim(),
        category: category.trim() || null,
        content,
      }),
    onSuccess: () => {
      toast.success("Saved to memory");
      qc.invalidateQueries({ queryKey: key });
      setOpen(false);
      setTitle2("");
      setCategory("");
      setContent("");
    },
    onError: () => toast.error("Could not save"),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              accentClass ?? "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing stored here yet.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((m) => (
              <div
                key={m.id}
                className="group flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{m.title}</span>
                    {m.category && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {m.category}
                      </span>
                    )}
                  </div>
                  {m.content && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.content}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {m.expires_at
                      ? `Expires ${formatDistanceToNow(new Date(m.expires_at), { addSuffix: true })}`
                      : `Saved ${formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}`}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await deleteMemory(m.id);
                    qc.invalidateQueries({ queryKey: key });
                  }}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete memory"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mem-title">Title</Label>
              <Input
                id="mem-title"
                autoFocus
                value={title2}
                onChange={(e) => setTitle2(e.target.value)}
                placeholder="e.g. Preferred case framework"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-cat">Category (optional)</Label>
              <Input
                id="mem-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="skill · template · fact"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mem-content">Details</Label>
              <Textarea
                id="mem-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="What should be remembered?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!title2.trim() || add.isPending} onClick={() => add.mutate()}>
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
