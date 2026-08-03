import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { extractWorkspaceGraph, getWorkspaceGraph, type GraphEntity } from "@/lib/graph.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelEmpty } from "./panel-empty";
import { toast } from "sonner";
import { Loader2, Network, RefreshCw, ArrowRight } from "lucide-react";

const TYPE_ORDER = ["person", "organization", "concept", "term", "event"];

export function GraphPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["graph", workspaceId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getWorkspaceGraph({ data: { workspaceId } }),
  });

  const extract = useMutation({
    mutationFn: () => extractWorkspaceGraph({ data: { workspaceId } }),
    onSuccess: (r) => {
      if (r.empty) {
        toast.info("Nothing indexed yet — add notes or documents first.");
      } else {
        toast.success(`Extracted ${r.entities} entities and ${r.edges} relationships`);
      }
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message || "Extraction failed"),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, GraphEntity[]>();
    for (const e of data?.entities ?? []) {
      (map.get(e.type) ?? map.set(e.type, []).get(e.type)!).push(e);
    }
    return [...map.entries()].sort(
      (a, b) => (TYPE_ORDER.indexOf(a[0]) + 99) % 99 - ((TYPE_ORDER.indexOf(b[0]) + 99) % 99),
    );
  }, [data]);

  const hasGraph = (data?.entities.length ?? 0) > 0;

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  }

  if (!hasGraph) {
    return (
      <PanelEmpty
        icon={Network}
        title="Map what this workspace knows"
        body="Extract people, organizations and concepts from your indexed notes, documents and memory — plus how they relate."
        action={
          <Button onClick={() => extract.mutate()} disabled={extract.isPending}>
            {extract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
            Extract knowledge graph
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data!.entities.length} entities · {data!.edges.length} relationships
        </p>
        <Button variant="outline" size="sm" onClick={() => extract.mutate()} disabled={extract.isPending}>
          {extract.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-extract
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h3 className="text-sm font-semibold">Entities</h3>
          <div className="mt-3 space-y-4">
            {grouped.map(([type, items]) => (
              <div key={type}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{type}</p>
                <div className="mt-2 space-y-2">
                  {items.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{e.name}</span>
                        {e.mentions > 1 && (
                          <Badge variant="secondary" className="text-[10px]">×{e.mentions}</Badge>
                        )}
                      </div>
                      {e.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{e.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h3 className="text-sm font-semibold">Relationships</h3>
          {data!.edges.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No relationships found yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data!.edges.map((edge) => (
                <li key={edge.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-medium">{edge.source.name}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{edge.relation}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{edge.target.name}</span>
                  </div>
                  {edge.evidence && (
                    <p className="mt-1 text-xs text-muted-foreground">{edge.evidence}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
