import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = "admin" | "moderator" | "user";

export interface AdminUserRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  roles: AppRole[];
}

/** Roles for the currently signed-in user. */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppRole[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.role as AppRole);
  });

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/**
 * Bootstrap: lets the current signed-in user become admin ONLY when no admin
 * exists yet. Safe to expose — once an admin exists it always returns claimed:false.
 */
export const claimAdminIfNone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ claimed: boolean }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) return { claimed: false };

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { claimed: true };
  });

/** Admin: list every user with their email, profile name and roles. */
export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [usersRes, rolesRes, profilesRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("profiles").select("user_id, display_name"),
    ]);
    if (usersRes.error) throw new Error(usersRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of rolesRes.data ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      rolesByUser.set(r.user_id, list);
    }
    const nameByUser = new Map<string, string | null>();
    for (const p of profilesRes.data ?? []) nameByUser.set(p.user_id, p.display_name);

    return usersRes.data.users.map((u) => ({
      userId: u.id,
      email: u.email ?? null,
      displayName: nameByUser.get(u.id) ?? null,
      createdAt: u.created_at ?? null,
      roles: (rolesByUser.get(u.id) ?? []).sort(),
    }));
  });

const SetRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "moderator", "user"]),
  grant: z.boolean(),
});

/** Admin: grant or revoke a role for a user. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetRoleInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context);
    const { userId: actingAdmin } = context;
    const { userId, role, grant } = data;

    // Guardrail: an admin cannot revoke their own admin role (avoids lockout).
    if (!grant && role === "admin" && userId === actingAdmin) {
      throw new Error("You cannot revoke your own admin role.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
