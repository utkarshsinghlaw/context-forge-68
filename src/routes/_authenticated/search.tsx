import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { globalSearch, type GlobalSearchResult } from "@/lib/search.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, StickyNote, FileText, Brain, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: SearchPage,
});

const sourceIcon: Record<string, typeof StickyNote> = {
  note: StickyNote,
  document: FileText,
  memory: Brain,
};
const tabFor: Record<string, string> = {
  note: "notes",
  document: "documents",
  memory: "memory",
};

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const searchFn = useServerFn(globalSearch);
  const [query, setQuery] = useState(q ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useMutation({
    mutationFn: (query: string) => searchFn({ data: { query } }),
    onError: (e: Error) => toast.error(e.message || "Search failed"),
  });

  const run = (value: string) => {
    const v = value.trim();
    if (!v) return;
    navigate({ to: "/search", search: { q: v }, replace: true });
    search.mutate(v);
  };

  // Run once on load when a query is present in the URL.
  useEffect(() => {
    if (q && q.trim()) {
      setQuery(q);
      search.mutate(q.trim());
    }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = search.data ?? [];
  const open = (r: GlobalSearchResult) => {
    if (!r.workspace_id) {
      navigate({ to: "/vault" });
      return;
    }
    navigate({
      to: "/w/$workspaceId",
      params: { workspaceId: r.workspace_id },
      search: { tab: tabFor[r.source_type] ?? "overview" },
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Search className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Search everything</h1>
          <p className="text-sm text-muted-foreground">
            Semantic + keyword search across every workspace and the vault.
          </p>
        </div>
      </div>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, documents and memory…"
          className="h-11"
        />
        <Button type="submit" className="h-11" disabled={!query.trim() || search.isPending}>
          {search.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </form>

      <div className="mt-6">
        {search.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching across your workspaces…
          </div>
        )}

        {search.isError && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{(search.error as Error).message || "Search failed"}</p>
          </div>
        )}

        {search.isSuccess && results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No matches found. Try different words — search understands meaning, not just exact terms.
          </div>
        )}

        {results.length > 0 && (
          <div className="grid gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"}
            </p>
            {results.map((r, i) => {
              const Icon = sourceIcon[r.source_type] ?? FileText;
              return (
                <button
                  key={`${r.source_id}-${i}`}
                  onClick={() => open(r)}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition hover:border-primary/40 hover:bg-accent/40"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.source_title || "Untitled"}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {r.workspace_name}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.snippet}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
