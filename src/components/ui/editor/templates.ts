import type { Editor } from "@tiptap/core";

function runCommand(editor: Editor, name: string, ...args: unknown[]) {
  const chain = editor.chain().focus() as unknown as Record<
    string,
    (...args: unknown[]) => { run: () => boolean }
  >;
  chain[name](...args).run();
}


export type Template = {
  label: string;
  description: string;
  icon: "file-text" | "list" | "star" | "target" | "briefcase" | "help-circle" | "type";
  content: string;
};

export const NOTE_TEMPLATES: Record<string, Template> = {
  star: {
    label: "STAR answer",
    description: "Situation, Task, Action, Result framework",
    icon: "star",
    content: `<h2>STAR: [Question title]</h2>
<p><strong>Situation:</strong> Set the context — where, when, and who was involved.</p>
<p><strong>Task:</strong> What was your specific responsibility or challenge?</p>
<p><strong>Action:</strong> What did you personally do? Use "I" statements.</p>
<p><strong>Result:</strong> What was the outcome? Quantify when possible.</p>
<p><strong>Reflection:</strong> What did you learn?</p>`,
  },
  par: {
    label: "PAR answer",
    description: "Problem, Action, Result framework",
    icon: "target",
    content: `<h2>PAR: [Question title]</h2>
<p><strong>Problem:</strong> Describe the challenge or conflict.</p>
<p><strong>Action:</strong> Explain the steps you took to address it.</p>
<p><strong>Result:</strong> Share the measurable outcome and lessons learned.</p>`,
  },
  project: {
    label: "Project case study",
    description: "Structured project deep-dive",
    icon: "briefcase",
    content: `<h2>Project: [Name]</h2>
<h3>Overview</h3>
<p>One-sentence summary of the project and its goal.</p>
<h3>My role</h3>
<p>What you owned, decided, and executed.</p>
<h3>Key decisions</h3>
<ul>
  <li>Decision 1 — trade-off and rationale</li>
  <li>Decision 2 — trade-off and rationale</li>
</ul>
<h3>Impact</h3>
<p>Metrics, before/after, and stakeholder feedback.</p>
<h3>What I would do differently</h3>
<p>Reflection and next iteration.</p>`,
  },
  prep: {
    label: "Interview prep",
    description: "Role-specific prep checklist",
    icon: "list",
    content: `<h2>Interview prep: [Company / role]</h2>
<h3>Company context</h3>
<ul>
  <li>Mission and product</li>
  <li>Recent news or launches</li>
  <li>Competitive landscape</li>
</ul>
<h3>Role expectations</h3>
<ul>
  <li>Key skills from JD</li>
  <li>Likely stakeholders</li>
  <li>Success metrics</li>
</ul>
<h3>Stories to have ready</h3>
<ul>
  <li>Leadership / conflict</li>
  <li>Failure / learning</li>
  <li>Impact / quantified win</li>
</ul>
<h3>Questions to ask</h3>
<ul>
  <li>Team culture</li>
  <li>First 90 days</li>
  <li>Growth path</li>
</ul>`,
  },
};

export const SLASH_COMMANDS = [
  {
    id: "heading",
    label: "Heading",
    description: "Large section heading",
    icon: "type" as const,
    action: (editor: Editor) => runCommand(editor, "toggleHeading", { level: 2 }),
  },
  {
    id: "h3",
    label: "Subheading",
    description: "Medium section heading",
    icon: "type" as const,
    action: (editor: Editor) => runCommand(editor, "toggleHeading", { level: 3 }),
  },
  {
    id: "bullet",
    label: "Bullet list",
    description: "Create a bulleted list",
    icon: "list" as const,
    action: (editor: Editor) => runCommand(editor, "toggleBulletList"),
  },
  {
    id: "numbered",
    label: "Numbered list",
    description: "Create a numbered list",
    icon: "list" as const,
    action: (editor: Editor) => runCommand(editor, "toggleOrderedList"),
  },
  {
    id: "quote",
    label: "Quote",
    description: "Insert a blockquote",
    icon: "type" as const,
    action: (editor: Editor) => runCommand(editor, "toggleBlockquote"),
  },
  {
    id: "star",
    label: "STAR template",
    description: "Situation, Task, Action, Result",
    icon: "star" as const,
    template: "star" as const,
  },
  {
    id: "par",
    label: "PAR template",
    description: "Problem, Action, Result",
    icon: "target" as const,
    template: "par" as const,
  },
  {
    id: "project",
    label: "Project case study",
    description: "Structured project deep-dive",
    icon: "briefcase" as const,
    template: "project" as const,
  },
  {
    id: "prep",
    label: "Interview prep",
    description: "Role-specific prep checklist",
    icon: "list" as const,
    template: "prep" as const,
  },
];
