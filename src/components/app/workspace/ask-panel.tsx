import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { reindexWorkspace, type Citation } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  StickyNote,
  FileText,
  Brain,
  CornerDownLeft,
  AlertCircle,
  MessageSquarePlus,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sourceIcon: Record<string, typeof StickyNote> = {
  note: StickyNote,
  document: FileText,
  memory: Brain,
};

function decodeCitations(header: string | null): Citation[] {
  if (!header) return [];
  try {
    const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Citation[];
  } catch {
    return [];
  }
}

type Turn = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  error?: string;
};

export function AskPanel({ workspaceId }: { workspaceId: string }) {
  const reindexFn = useServerFn(reindexWorkspace);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the conversation when switching workspaces.
  useEffect(() => {
    abortRef.current?.abort();
    setTurns([]);
    setQuestion("");
  }, [workspaceId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const sync = useMutation({
    mutationFn: () => reindexFn({ data: { workspaceId } }),
    onSuccess: (r) =>
      toast.success(`Knowledge synced — ${r.indexed} chunks from ${r.sources} sources`),
    onError: (e: Error) => toast.error(e.message || "Sync failed"),
  });

  // Runs a turn against `history` and streams into the last (assistant) turn.
  const runTurn = async (q: string, history: Turn[]) => {
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workspaceId,
          question: q,
          history: history.map((t) => ({ role: t.role, content: t.content })),
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text().catch(() => "")) || "Ask failed");
      }
      const citations = decodeCitations(res.headers.get("x-citations"));
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], citations };
        return next;
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], content: acc };
          return next;
        });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        const message = (e as Error).message || "Ask failed";
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], error: message };
          return next;
        });
        toast.error(message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const submit = async () => {
    const q = question.trim();
    if (!q || streaming) return;
    setQuestion("");
    // History is everything so far; the new user turn + empty assistant turn are appended.
    const history = turns;
    setTurns([...history, { role: "user", content: q }, { role: "assistant", content: "" }]);
    await runTurn(q, history);
  };

  const retryLast = async () => {
    if (streaming) return;
    // Find the last user turn and drop its (errored) assistant turn.
    const lastUserIdx = [...turns].map((t) => t.role).lastIndexOf("user");
    if (lastUserIdx < 0) return;
    const q = turns[lastUserIdx].content;
    const history = turns.slice(0, lastUserIdx);
    setTurns([...history, { role: "user", content: q }, { role: "assistant", content: "" }]);
    await runTurn(q, history);
  };

  const reset = () => {
    abortRef.current?.abort();
    setTurns([]);
    setQuestion("");
  };

  const hasConversation = turns.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Ask questions grounded in this workspace — your notes, documents and memory. Indexing is
          automatic on every save; use Rebuild only if something looks out of date.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {hasConversation && (
            <Button variant="outline" size="sm" disabled={streaming} onClick={reset}>
              <MessageSquarePlus className="h-4 w-4" /> New chat
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={sync.isPending}
            onClick={() => sync.mutate()}
          >
            {sync.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Rebuild index
          </Button>
        </div>
      </div>

      {hasConversation && (
        <div ref={scrollRef} className="max-h-[52vh] space-y-4 overflow-y-auto pr-1">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="flex max-w-[85%] items-start gap-2">
                  <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {t.content}
                  </div>
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <User className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ) : (
              <div key={i} className="space-y-3">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" /> Answer
                    {streaming && i === turns.length - 1 && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                  </div>
                  {t.error ? (
                    <div className="flex items-start gap-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="space-y-2">
                        <p>{t.error}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={retryLast}
                          disabled={streaming}
                        >
                          <RefreshCw className="h-4 w-4" /> Try again
                        </Button>
                      </div>
                    </div>
                  ) : t.content ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {t.content}
                      {streaming && i === turns.length - 1 && (
                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
                      )}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Retrieving context and thinking…
                    </div>
                  )}
                </div>

                {t.citations && t.citations.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Sources
                    </p>
                    <div className="grid gap-2">
                      {t.citations.map((c, ci) => {
                        const Icon = sourceIcon[c.source_type] ?? FileText;
                        return (
                          <div
                            key={`${c.source_id}-${ci}`}
                            className="rounded-xl border border-border bg-card/60 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-accent-foreground">
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              <span className="text-sm font-medium">
                                [{ci + 1}] {c.source_title || "Untitled"}
                              </span>
                              <span className="ml-auto text-xs capitalize text-muted-foreground">
                                {c.source_type}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                              {c.snippet}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          rows={3}
          placeholder={
            hasConversation
              ? "Ask a follow-up…"
              : "What does the brief say about liability? Summarize the case strategy…"
          }
          className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to ask</span>
          <Button size="sm" disabled={!question.trim() || streaming} onClick={submit}>
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {hasConversation ? "Send" : "Ask"}
          </Button>
        </div>
      </div>

      {!hasConversation && (
        <div className={cn("rounded-2xl border border-dashed border-border p-8 text-center")}>
          <CornerDownLeft className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Ask anything about this workspace — your notes, documents and memory are indexed
            automatically as you save them. Ask follow-ups and the assistant keeps the thread in
            context.
          </p>
        </div>
      )}
    </div>
  );
}
