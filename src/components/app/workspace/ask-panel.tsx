import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { reindexWorkspace, askWorkspace, type Citation } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Loader2, StickyNote, FileText, Brain, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const sourceIcon: Record<string, typeof StickyNote> = {
  note: StickyNote,
  document: FileText,
  memory: Brain,
};

export function AskPanel({ workspaceId }: { workspaceId: string }) {
  const reindexFn = useServerFn(reindexWorkspace);
  const askFn = useServerFn(askWorkspace);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);

  const sync = useMutation({
    mutationFn: () => reindexFn({ data: { workspaceId } }),
    onSuccess: (r) => toast.success(`Knowledge synced — ${r.indexed} chunks from ${r.sources} sources`),
    onError: (e: Error) => toast.error(e.message || "Sync failed"),
  });

  const ask = useMutation({
    mutationFn: (q: string) => askFn({ data: { workspaceId, question: q } }),
    onSuccess: (r) => {
      setAnswer(r.answer);
      setCitations(r.citations);
    },
    onError: (e: Error) => toast.error(e.message || "Ask failed"),
  });

  const submit = () => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    ask.mutate(q);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Ask questions grounded in this workspace — your notes, documents and memory. Indexing is automatic on every save; use Rebuild only if something looks out of date.
        </p>
        <Button variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>
          {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Rebuild index
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={3}
          placeholder="What does the brief say about liability? Summarize the case strategy…"
          className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to ask</span>
          <Button size="sm" disabled={!question.trim() || ask.isPending} onClick={submit}>
            {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Ask
          </Button>
        </div>
      </div>

      {ask.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Retrieving context and thinking…
        </div>
      )}

      {answer && !ask.isPending && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Answer
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>
          </div>

          {citations.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
              <div className="grid gap-2">
                {citations.map((c, i) => {
                  const Icon = sourceIcon[c.source_type] ?? FileText;
                  return (
                    <div key={`${c.source_id}-${i}`} className="rounded-xl border border-border bg-card/60 p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-accent-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-sm font-medium">[{i + 1}] {c.source_title || "Untitled"}</span>
                        <span className="ml-auto text-xs capitalize text-muted-foreground">{c.source_type}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.snippet}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!answer && !ask.isPending && (
        <div className={cn("rounded-2xl border border-dashed border-border p-8 text-center")}>
          <CornerDownLeft className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Ask anything about this workspace — your notes, documents and memory are indexed automatically as you save them.
          </p>
        </div>
      )}
    </div>
  );
}