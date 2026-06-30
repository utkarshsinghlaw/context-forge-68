import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUsersWithRoles,
  setUserRole,
  claimAdminIfNone,
  type AdminUserRow,
  type AppRole,
} from "@/lib/roles.functions";
import { useRoles } from "@/hooks/use-roles";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Shield, ShieldCheck, ShieldAlert, UserCog, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const ALL_ROLES: { role: AppRole; label: string; icon: typeof Shield }[] = [
  { role: "admin", label: "Admin", icon: ShieldCheck },
  { role: "moderator", label: "Moderator", icon: ShieldAlert },
  { role: "user", label: "User", icon: Shield },
];

const roleBadge: Record<AppRole, string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  moderator: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  user: "bg-muted text-muted-foreground border-border",
};

function ClaimAdmin({ onClaimed }: { onClaimed: () => void }) {
  const claimFn = useServerFn(claimAdminIfNone);
  const claim = useMutation({
    mutationFn: () => claimFn(),
    onSuccess: (r) => {
      if (r.claimed) {
        toast.success("You are now an admin.");
        onClaimed();
      } else {
        toast.error("An admin already exists. Ask them to grant you access.");
      }
    },
    onError: (e: Error) => toast.error(e.message || "Could not claim admin"),
  });

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Crown className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Admin access required</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You don't have the admin role. If no admin has been set up yet, you can claim it now.
      </p>
      <Button className="mt-5" onClick={() => claim.mutate()} disabled={claim.isPending}>
        {claim.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
        Claim admin role
      </Button>
    </div>
  );
}

function UserRow({ row }: { row: AdminUserRow }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const setRoleFn = useServerFn(setUserRole);
  const isSelf = user?.id === row.userId;
  const name = row.displayName || row.email?.split("@")[0] || "Unknown";

  const mutate = useMutation({
    mutationFn: (v: { role: AppRole; grant: boolean }) =>
      setRoleFn({ data: { userId: row.userId, role: v.role, grant: v.grant } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });

  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-brand text-sm font-semibold text-primary-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {name}
            {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_ROLES.map(({ role, label, icon: Icon }) => {
          const has = row.roles.includes(role);
          const lockSelfAdmin = isSelf && role === "admin" && has;
          return (
            <button
              key={role}
              disabled={mutate.isPending || lockSelfAdmin}
              onClick={() => mutate.mutate({ role, grant: !has })}
              title={
                lockSelfAdmin
                  ? "You cannot revoke your own admin role"
                  : has
                    ? `Revoke ${label}`
                    : `Grant ${label}`
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50",
                has ? roleBadge[role] : "border-dashed border-border text-muted-foreground/60 hover:text-foreground hover:border-foreground/30",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdminPanel() {
  const { isAdmin, loading: rolesLoading } = useRoles();
  const qc = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  if (rolesLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <ClaimAdmin
        onClaimed={() => {
          qc.invalidateQueries({ queryKey: ["my-roles"] });
          qc.invalidateQueries({ queryKey: ["admin-users"] });
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserCog className="h-4 w-4 text-muted-foreground" />
          {users.data?.length ?? 0} {users.data?.length === 1 ? "user" : "users"}
        </div>
      </div>
      {users.isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : users.isError ? (
        <p className="px-4 py-8 text-center text-sm text-destructive">
          {(users.error as Error).message}
        </p>
      ) : (
        (users.data ?? []).map((row) => <UserRow key={row.userId} row={row} />)
      )}
    </div>
  );
}