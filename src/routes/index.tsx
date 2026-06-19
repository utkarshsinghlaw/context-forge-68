import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Command,
  Layers,
  Network,
  Gauge,
  ShieldCheck,
  Sparkles,
  GraduationCap,
  Scale,
  Briefcase,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Interview Buddy — The OS for knowledge work" },
      {
        name: "description",
        content:
          "A workspace-first operating system for MBA students, consultants, lawyers, researchers and job seekers. Context before AI, three-layer memory, and a command palette.",
      },
      { property: "og:title", content: "Interview Buddy — The OS for knowledge work" },
      {
        property: "og:description",
        content: "Workspace-first professional assistance with contextual memory.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Layers,
    title: "Workspace first",
    body: "Everything lives inside a workspace — Leeds MBA, Bain Recruiting, Commercial Arbitration. No floating chat.",
  },
  {
    icon: Network,
    title: "Three-layer memory",
    body: "Working memory for the session, workspace memory that persists, and a vault of permanent knowledge shared everywhere.",
  },
  {
    icon: Sparkles,
    title: "Context before AI",
    body: "Requests flow through workspace context and retrieval before any model — quality of context over size of model.",
  },
  {
    icon: Gauge,
    title: "Fast software",
    body: "Instant workspace switching, sub-100ms search and a command palette on ⌘K. Built for focus.",
  },
  {
    icon: ShieldCheck,
    title: "Your data, isolated",
    body: "Each workspace is private to you. Local-first principles with optional cloud sync.",
  },
  {
    icon: Command,
    title: "Command palette",
    body: "Summarize a meeting, prepare a hearing, generate flashcards — every action a keystroke away.",
  },
];

const PERSONAS = [
  { icon: GraduationCap, label: "MBA students" },
  { icon: Briefcase, label: "Consultants & recruits" },
  { icon: Scale, label: "Lawyers & researchers" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand text-primary-foreground">
              <Command className="h-4 w-4" />
            </span>
            Interview Buddy
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Context before AI — not another chatbot
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            The operating system for{" "}
            <span className="text-gradient-brand">knowledge work</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Organize your professional life into focused workspaces with three layers
            of memory. Real-time assistance for meetings, interviews, coursework and
            cases — all in one fast, private app.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/auth">Open your workspace</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">See how it works</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            {PERSONAS.map((p) => (
              <span key={p.label} className="inline-flex items-center gap-2">
                <p.icon className="h-4 w-4 text-primary" /> {p.label}
              </span>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop"
              >
                <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="overflow-hidden rounded-3xl bg-gradient-brand px-8 py-14 text-center text-primary-foreground shadow-pop sm:px-16">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Your knowledge, finally organized for how you work.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
              Create your first workspace and feel the difference in seconds.
            </p>
            <Button size="lg" variant="secondary" className="mt-8" asChild>
              <Link to="/auth">Get started free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Interview Buddy</span>
          <span>Workspace-first · Context before AI · Local-first</span>
        </div>
      </footer>
    </div>
  );
}
