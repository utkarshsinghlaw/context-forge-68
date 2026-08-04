import { Link } from "@tanstack/react-router";
import { MemorySection } from "./memory-section";
import { Zap, Brain, Vault, ArrowRight } from "lucide-react";

export function MemoryPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-accent/40 p-4 text-sm text-muted-foreground">
        Interview Buddy uses three layers of memory. Working memory is for the current session and
        auto-expires; workspace memory persists with this workspace; the Vault is permanent
        knowledge shared across every workspace.
      </div>

      <MemorySection
        layer="working"
        workspaceId={workspaceId}
        title="Working Memory"
        description="Session-scoped context. Auto-expires after 12 hours."
        icon={Zap}
        accentClass="bg-[oklch(0.95_0.05_80)] text-[oklch(0.55_0.13_60)] dark:bg-[oklch(0.34_0.06_70)] dark:text-[oklch(0.82_0.1_75)]"
      />

      <MemorySection
        layer="workspace"
        workspaceId={workspaceId}
        title="Workspace Memory"
        description="Persistent knowledge tied to this workspace."
        icon={Brain}
        accentClass="bg-accent text-accent-foreground"
      />

      <Link
        to="/vault"
        className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[oklch(0.95_0.03_300)] text-[oklch(0.5_0.18_300)] dark:bg-[oklch(0.32_0.06_300)] dark:text-[oklch(0.82_0.1_300)]">
          <Vault className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="font-semibold">Knowledge Vault</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Permanent knowledge — skills, templates, frameworks — shared across all workspaces.
          </p>
        </div>
        <ArrowRight className="h-4 w-4 -translate-x-1 text-muted-foreground transition-all group-hover:translate-x-0" />
      </Link>
    </div>
  );
}
