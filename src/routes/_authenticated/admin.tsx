import { createFileRoute } from "@tanstack/react-router";
import { AdminPanel } from "@/components/app/admin/admin-panel";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Shield className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage user roles and access across Interview Buddy.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <AdminPanel />
      </div>
    </div>
  );
}