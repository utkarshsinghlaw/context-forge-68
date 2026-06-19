import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon?: LucideIcon;
  keywords?: string;
  run: () => void;
}

interface CommandCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  actions: CommandAction[];
  registerActions: (actions: CommandAction[]) => () => void;
}

const Ctx = createContext<CommandCtx | undefined>(undefined);

export function CommandProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [registries, setRegistries] = useState<Record<string, CommandAction[]>>({});

  const registerActions = useCallback((actions: CommandAction[]) => {
    const key = Math.random().toString(36).slice(2);
    setRegistries((r) => ({ ...r, [key]: actions }));
    return () => {
      setRegistries((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const actions = useMemo(
    () => Object.values(registries).flat(),
    [registries],
  );

  return (
    <Ctx.Provider
      value={{ open, setOpen, toggle: () => setOpen((o) => !o), actions, registerActions }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCommand() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCommand must be used within CommandProvider");
  return ctx;
}

/** Register contextual actions for the lifetime of a component. */
export function useRegisterCommands(actions: CommandAction[], deps: unknown[]) {
  const { registerActions } = useCommand();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => registerActions(actions), deps);
}