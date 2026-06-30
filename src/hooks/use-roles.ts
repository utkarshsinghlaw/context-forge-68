import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles, type AppRole } from "@/lib/roles.functions";
import { useAuth } from "@/hooks/use-auth";

/**
 * Roles for the currently signed-in user. Returns an empty array while loading
 * or when signed out. `isAdmin` is the common gate used by the UI.
 */
export function useRoles() {
  const { user, loading } = useAuth();
  const getMyRolesFn = useServerFn(getMyRoles);

  const query = useQuery({
    queryKey: ["my-roles", user?.id],
    queryFn: () => getMyRolesFn(),
    enabled: !loading && !!user,
    staleTime: 60_000,
  });

  const roles = (query.data ?? []) as AppRole[];
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isModerator: roles.includes("moderator"),
    loading: loading || query.isLoading,
  };
}