import { createFileRoute } from "@tanstack/react-router";
import { MemorySection } from "@/components/app/workspace/memory-section";
import { Vault } from "lucide-react";

export const Route = createFileRoute("/_authenticated/vault")({
  component: VaultPage,
});

function VaultPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[oklch(0.95_0.03_300)] text-[oklch(0.5_0.18_300)] dark:bg-[oklch(0.32_0.06_300)] dark:text-[oklch(0.82_0.1_300)]">
          <Vault className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Vault</h1>
          <p className="text-sm text-muted-foreground">
            Permanent knowledge shared across every workspace.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-accent/40 p-4 text-sm text-muted-foreground">
        The Vault holds your skills, templates, career history, frameworks and research — the
        knowledge you carry into every project.
      </div>

      <div className="mt-4">
        <MemorySection
          layer="vault"
          workspaceId={null}
          title="Vault entries"
          description="Available in every workspace."
          icon={Vault}
          accentClass="bg-[oklch(0.95_0.03_300)] text-[oklch(0.5_0.18_300)] dark:bg-[oklch(0.32_0.06_300)] dark:text-[oklch(0.82_0.1_300)]"
        />
      </div>
    </div>
  );
}
