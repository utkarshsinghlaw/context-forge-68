import type { WorkspaceKind } from "./api";
import {
  Briefcase,
  Scale,
  GraduationCap,
  FlaskConical,
  Mic,
  Folder,
  type LucideIcon,
} from "lucide-react";

export interface KindMeta {
  kind: WorkspaceKind;
  label: string;
  icon: LucideIcon;
  blurb: string;
}

export const WORKSPACE_KINDS: KindMeta[] = [
  { kind: "mba", label: "MBA", icon: GraduationCap, blurb: "Coursework, study notes & flashcards" },
  { kind: "recruiting", label: "Recruiting", icon: Briefcase, blurb: "Applications, referrals & interviews" },
  { kind: "legal", label: "Legal Matter", icon: Scale, blurb: "Pleadings, authorities & chronology" },
  { kind: "research", label: "Research", icon: FlaskConical, blurb: "Literature, sources & writing" },
  { kind: "interview", label: "Interview Prep", icon: Mic, blurb: "Practice, fit stories & feedback" },
  { kind: "general", label: "General", icon: Folder, blurb: "A flexible knowledge workspace" },
];

export function kindMeta(kind: WorkspaceKind): KindMeta {
  return WORKSPACE_KINDS.find((k) => k.kind === kind) ?? WORKSPACE_KINDS[5];
}

/** Accent colors keyed by workspace.color, expressed as tailwind-friendly classes. */
export const WORKSPACE_COLORS: Record<string, { dot: string; soft: string; text: string }> = {
  blue: { dot: "bg-[oklch(0.6_0.196_256)]", soft: "bg-[oklch(0.95_0.028_256)] dark:bg-[oklch(0.32_0.05_256)]", text: "text-[oklch(0.5_0.18_256)] dark:text-[oklch(0.8_0.1_256)]" },
  teal: { dot: "bg-[oklch(0.66_0.13_190)]", soft: "bg-[oklch(0.95_0.03_190)] dark:bg-[oklch(0.32_0.05_190)]", text: "text-[oklch(0.5_0.12_190)] dark:text-[oklch(0.8_0.08_190)]" },
  violet: { dot: "bg-[oklch(0.58_0.2_300)]", soft: "bg-[oklch(0.95_0.03_300)] dark:bg-[oklch(0.32_0.06_300)]", text: "text-[oklch(0.5_0.18_300)] dark:text-[oklch(0.82_0.1_300)]" },
  amber: { dot: "bg-[oklch(0.74_0.15_70)]", soft: "bg-[oklch(0.95_0.05_80)] dark:bg-[oklch(0.34_0.06_70)]", text: "text-[oklch(0.55_0.13_60)] dark:text-[oklch(0.82_0.1_75)]" },
  rose: { dot: "bg-[oklch(0.64_0.2_15)]", soft: "bg-[oklch(0.95_0.03_15)] dark:bg-[oklch(0.33_0.06_15)]", text: "text-[oklch(0.55_0.2_15)] dark:text-[oklch(0.82_0.12_15)]" },
  green: { dot: "bg-[oklch(0.66_0.16_150)]", soft: "bg-[oklch(0.95_0.04_150)] dark:bg-[oklch(0.32_0.06_150)]", text: "text-[oklch(0.5_0.14_150)] dark:text-[oklch(0.8_0.1_150)]" },
};

export const WORKSPACE_COLOR_KEYS = Object.keys(WORKSPACE_COLORS);

export function colorMeta(color: string) {
  return WORKSPACE_COLORS[color] ?? WORKSPACE_COLORS.blue;
}