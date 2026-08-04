import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyDisplayName } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings as SettingsIcon, Loader2, Sun, Moon, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const [name, setName] = useState("");

  useEffect(() => {
    if (profile) setName(profile.display_name ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: () => updateMyDisplayName(name),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Could not update profile"),
  });

  const dirty = (profile?.display_name ?? "") !== name.trim() && name.trim().length > 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <SettingsIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your profile and preferences.</p>
        </div>
      </div>

      {/* Profile */}
      <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Profile</h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} disabled readOnly />
          </div>
          <div className="flex justify-end">
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
            </Button>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Appearance</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Choose how Interview Buddy looks.</p>
        <div className="mt-4 flex gap-2">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={
                "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors " +
                (theme === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent/50")
              }
            >
              {t === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {t === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </section>

      {/* Account */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Account</h2>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Sign out of Interview Buddy on this device.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </section>
    </div>
  );
}
