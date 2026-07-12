import { type ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listWorkspaces } from "@/lib/api";
import { kindMeta, colorMeta } from "@/lib/workspace-meta";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useTheme } from "@/lib/theme";
import { CommandProvider, useCommand } from "./command-context";
import { CommandPalette } from "./command-palette";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  Home,
  Vault,
  Plus,
  Search,
  Moon,
  Sun,
  LogOut,
  Menu,
  ChevronsUpDown,
  Shield,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useRoles();
  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
  });

  const navItem = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
    );

  return (
    <div className="flex h-full flex-col gap-4">
      <Link
        to="/home"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-1 pt-1 font-semibold"
      >
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
          <Command className="h-4 w-4" />
        </span>
        Interview Buddy
      </Link>

      <nav className="space-y-1">
        <Link to="/home" onClick={onNavigate} className={navItem(pathname === "/home")}>
          <Home className="h-4 w-4" /> Workspaces
        </Link>
        <Link to="/search" onClick={onNavigate} className={navItem(pathname === "/search")}>
          <Search className="h-4 w-4" /> Search
        </Link>
        <Link to="/vault" onClick={onNavigate} className={navItem(pathname === "/vault")}>
          <Vault className="h-4 w-4" /> Knowledge Vault
        </Link>
        {isAdmin && (
          <Link to="/admin" onClick={onNavigate} className={navItem(pathname === "/admin")}>
            <Shield className="h-4 w-4" /> Admin
          </Link>
        )}
        <Link to="/settings" onClick={onNavigate} className={navItem(pathname === "/settings")}>
          <Settings className="h-4 w-4" /> Settings
        </Link>
      </nav>

      <div className="flex items-center justify-between px-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workspaces
        </span>
        <button
          onClick={() => {
            onNavigate?.();
            navigate({ to: "/home", search: { new: true } });
          }}
          className="grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label="New workspace"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {workspaces.length === 0 && (
          <p className="px-2.5 py-2 text-sm text-muted-foreground">No workspaces yet.</p>
        )}
        {workspaces.map((w) => {
          const Icon = kindMeta(w.kind).icon;
          const active = pathname.startsWith(`/w/${w.id}`);
          return (
            <Link
              key={w.id}
              to="/w/$workspaceId"
              params={{ workspaceId: w.id }}
              onClick={onNavigate}
              className={navItem(active)}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", colorMeta(w.color).dot)} />
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">{w.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function UserMenu() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const name = (user?.user_metadata?.display_name as string) || user?.email?.split("@")[0] || "Account";
  const initial = name.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-brand text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={toggle}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <Settings className="h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { toggle: toggleCmd } = useCommand();
  const { theme, toggle: toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>
      <button
        onClick={toggleCmd}
        className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/40 sm:max-w-md"
      >
        <Search className="h-4 w-4" />
        Search or run a command
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </button>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
      </Button>
    </header>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-3 md:flex">
        <div className="flex-1 overflow-hidden">
          <SidebarBody />
        </div>
        <UserMenu />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-3">
          <div className="flex h-full flex-col gap-4">
            <div className="flex-1 overflow-hidden">
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </div>
            <UserMenu />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CommandProvider>
      <Shell>{children}</Shell>
    </CommandProvider>
  );
}