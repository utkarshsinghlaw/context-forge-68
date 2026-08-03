import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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

/**
 * Registry lives outside React state so children can register during their own
 * mount effect without triggering a "state update on an unmounted component"
 * warning in the provider. Subscribers are notified via useSyncExternalStore.
 */
function createRegistry() {
  const map = new Map<string, CommandAction[]>();
  let snapshot: CommandAction[] = [];
  const listeners = new Set<() => void>();
  const emit = () => {
    snapshot = [...map.values()].flat();
    listeners.forEach((l) => l());
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    register(actions: CommandAction[]) {
      const key = Math.random().toString(36).slice(2);
      map.set(key, actions);
      emit();
      return () => {
        if (map.delete(key)) emit();
      };
    },
  };
}

export function CommandProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const registryRef = useRef<ReturnType<typeof createRegistry>>();
  if (!registryRef.current) registryRef.current = createRegistry();
  const registry = registryRef.current;

  const registerActions = useCallback(
    (actions: CommandAction[]) => registry.register(actions),
    [registry],
  );

  const actions = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  );

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

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const value = useMemo(
    () => ({ open, setOpen, toggle, actions, registerActions }),
    [open, toggle, actions, registerActions],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
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