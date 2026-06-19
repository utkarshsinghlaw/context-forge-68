import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useCommand } from "./command-context";
import { listWorkspaces } from "@/lib/api";
import { kindMeta } from "@/lib/workspace-meta";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  Vault,
  Plus,
  Moon,
  Sun,
  LogOut,
  ArrowRight,
} from "lucide-react";

export function CommandPalette() {
  const { open, setOpen, actions } = useCommand();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
  });

  const go = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 0);
  };

  const grouped = actions.reduce<Record<string, typeof actions>>((acc, a) => {
    (acc[a.group] ??= []).push(a);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search workspaces…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {Object.entries(grouped).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((a) => (
              <CommandItem
                key={a.id}
                value={`${a.label} ${a.keywords ?? ""}`}
                onSelect={() => go(a.run)}
              >
                {a.icon ? <a.icon className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                <span>{a.label}</span>
                {a.hint && (
                  <span className="ml-auto text-xs text-muted-foreground">{a.hint}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandGroup heading="Navigate">
          <CommandItem value="home workspaces overview" onSelect={() => go(() => navigate({ to: "/home" }))}>
            <Home className="h-4 w-4" /> All workspaces
          </CommandItem>
          <CommandItem value="knowledge vault" onSelect={() => go(() => navigate({ to: "/vault" }))}>
            <Vault className="h-4 w-4" /> Knowledge Vault
          </CommandItem>
          <CommandItem value="new create workspace" onSelect={() => go(() => navigate({ to: "/home", search: { new: true } }))}>
            <Plus className="h-4 w-4" /> New workspace
          </CommandItem>
        </CommandGroup>

        {workspaces.length > 0 && (
          <CommandGroup heading="Switch workspace">
            {workspaces.map((w) => {
              const Icon = kindMeta(w.kind).icon;
              return (
                <CommandItem
                  key={w.id}
                  value={`workspace ${w.name} ${w.kind}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/w/$workspaceId", params: { workspaceId: w.id } }))
                  }
                >
                  <Icon className="h-4 w-4" /> {w.name}
                  <span className="ml-auto text-xs capitalize text-muted-foreground">
                    {kindMeta(w.kind).label}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem value="toggle theme dark light mode" onSelect={() => go(toggle)}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </CommandItem>
          <CommandItem
            value="sign out log out"
            onSelect={() =>
              go(async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              })
            }
          >
            <LogOut className="h-4 w-4" /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}