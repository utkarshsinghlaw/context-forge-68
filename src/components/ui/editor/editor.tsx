import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Typography from "@tiptap/extension-typography";
import { SlashCommand, type SlashCommandItem } from "./slash-command";
import { SLASH_COMMANDS } from "./templates";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Wand2,
} from "lucide-react";

function ensureHtmlContent(content: string): string {
  if (!content) return "<p></p>";
  if (content.trim().startsWith("<")) return content;
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`);
  return paragraphs.join("");
}

export type NoteEditorProps = {
  initialContent: string;
  onChange: (html: string) => void;
  onAsk?: () => void;
  placeholder?: string;
};

export function RichNoteEditor({ initialContent, onChange, onAsk, placeholder }: NoteEditorProps) {
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    items: SlashCommandItem[];
    selected: number;
    position: { top: number; left: number };
  }>({ open: false, items: [], selected: 0, position: { top: 0, left: 0 } });

  const slashMenuRef = useRef<HTMLDivElement>(null);
  const suggestionRef = useRef<{
    props: SuggestionProps<SlashCommandItem> | null;
    onKeyDown: (event: KeyboardEvent) => boolean;
  }>({ props: null, onKeyDown: () => false });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Typography,
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      SlashCommand.configure({
        suggestion: {
          render: () => {
            return {
              onStart: (props) => {
                suggestionRef.current.props = props;
                const rect = props.clientRect?.();
                if (rect) {
                  setSlashMenu({
                    open: true,
                    items: props.items,
                    selected: 0,
                    position: { top: rect.bottom + 8, left: rect.left },
                  });
                }
              },
              onUpdate: (props) => {
                suggestionRef.current.props = props;
                const rect = props.clientRect?.();
                setSlashMenu((prev) => ({
                  ...prev,
                  open: true,
                  items: props.items,
                  selected: 0,
                  position: rect ? { top: rect.bottom + 8, left: rect.left } : prev.position,
                }));
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                const { event } = props;
                const { selected, items } = slashMenu;
                if (!slashMenu.open) return false;

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setSlashMenu((prev) => ({
                    ...prev,
                    selected: (prev.selected - 1 + prev.items.length) % prev.items.length,
                  }));
                  return true;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setSlashMenu((prev) => ({
                    ...prev,
                    selected: (prev.selected + 1) % prev.items.length,
                  }));
                  return true;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const item = items[selected];
                  if (item) {
                    suggestionRef.current.props?.command(item);
                  }
                  setSlashMenu((prev) => ({ ...prev, open: false }));
                  return true;
                }
                if (event.key === "Escape") {
                  setSlashMenu((prev) => ({ ...prev, open: false }));
                  return true;
                }
                return false;
              },
              onExit: () => {
                setSlashMenu((prev) => ({ ...prev, open: false }));
                suggestionRef.current.props = null;
              },
            };
          },
        },
      }),
    ],
    content: ensureHtmlContent(initialContent),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[320px] px-1 py-1",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const html = ensureHtmlContent(initialContent);
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html);
    }
  }, [editor, initialContent]);

  useEffect(() => {
    if (!slashMenu.open) return;
    const active = slashMenuRef.current?.querySelector<HTMLElement>("[data-selected='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [slashMenu.selected, slashMenu.open]);

  if (!editor) return null;

  return (
    <div className="relative flex flex-col">
      <Toolbar editor={editor} onAsk={onAsk} />
      <EditorContent editor={editor} className="flex-1" />
      <BubbleMenu editor={editor}>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-pop">
          <ToolbarButton editor={editor} command="toggleBold" icon={Bold} label="Bold" />
          <ToolbarButton editor={editor} command="toggleItalic" icon={Italic} label="Italic" />
          <ToolbarButton
            editor={editor}
            command="toggleUnderline"
            icon={UnderlineIcon}
            label="Underline"
          />
          <ToolbarButton
            editor={editor}
            command="toggleStrike"
            icon={Strikethrough}
            label="Strike"
          />
          <div className="mx-1 h-4 w-px bg-border" />
          <LinkButton editor={editor} />
        </div>
      </BubbleMenu>

      {slashMenu.open && (
        <div
          ref={slashMenuRef}
          className="absolute z-50 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-pop"
          style={{ top: slashMenu.position.top, left: slashMenu.position.left }}
        >
          {slashMenu.items.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No commands found</div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {slashMenu.items.map((item, index) => (
                <button
                  key={item.id}
                  data-selected={index === slashMenu.selected}
                  onClick={() => {
                    suggestionRef.current.props?.command(item);
                    setSlashMenu((prev) => ({ ...prev, open: false }));
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                    index === slashMenu.selected ? "bg-accent" : "hover:bg-muted",
                  )}
                >
                  <CommandIcon id={item.id} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
            ↑↓ to navigate · Enter to select · Esc to close
          </div>
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, onAsk }: { editor: Editor; onAsk?: () => void }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted/50 p-1">
      <ToolbarButton editor={editor} command="toggleBold" icon={Bold} label="Bold" />
      <ToolbarButton editor={editor} command="toggleItalic" icon={Italic} label="Italic" />
      <ToolbarButton
        editor={editor}
        command="toggleUnderline"
        icon={UnderlineIcon}
        label="Underline"
      />
      <ToolbarButton editor={editor} command="toggleStrike" icon={Strikethrough} label="Strike" />
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        editor={editor}
        command="toggleHeading"
        commandArgs={{ level: 2 }}
        activeName="heading"
        activeArgs={{ level: 2 }}
        icon={Heading2}
        label="Heading"
      />
      <ToolbarButton
        editor={editor}
        command="toggleHeading"
        commandArgs={{ level: 3 }}
        activeName="heading"
        activeArgs={{ level: 3 }}
        icon={Heading3}
        label="Subheading"
      />

      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton
        editor={editor}
        command="toggleBulletList"
        icon={List}
        label="Bullet list"
      />
      <ToolbarButton
        editor={editor}
        command="toggleOrderedList"
        icon={ListOrdered}
        label="Numbered list"
      />
      <ToolbarButton editor={editor} command="toggleBlockquote" icon={Quote} label="Quote" />
      <div className="mx-1 h-4 w-px bg-border" />
      <LinkButton editor={editor} />
      {onAsk && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onAsk}
            aria-label="Ask AI"
            className="text-primary"
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </>
      )}
      <div className="ml-auto flex items-center gap-1.5 pr-2">
        <span className="text-xs text-muted-foreground">
          Type <span className="font-medium">/</span> for templates
        </span>
      </div>
    </div>
  );
}

function ToolbarButton({
  editor,
  command,
  commandArgs,
  activeName,
  activeArgs,
  icon: Icon,
  label,
}: {
  editor: Editor;
  command: string;
  commandArgs?: Record<string, unknown>;
  activeName?: string;
  activeArgs?: Record<string, unknown>;
  icon: React.ElementType;
  label: string;
}) {
  const active = editor.isActive(activeName ?? command, activeArgs ?? commandArgs);
  const chain = editor.chain().focus() as unknown as Record<
    string,
    (...args: unknown[]) => { run: () => boolean }
  >;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => chain[command](...(commandArgs ? [commandArgs] : [])).run()}
      aria-label={label}
      className={cn("h-8 w-8", active && "bg-accent text-accent-foreground")}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}


function LinkButton({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const active = editor.isActive("link");
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={setLink}
      aria-label="Link"
      className={cn("h-8 w-8", active && "bg-accent text-accent-foreground")}
    >
      <LinkIcon className="h-4 w-4" />
    </Button>
  );
}

function CommandIcon({ id }: { id: string }) {
  switch (id) {
    case "star":
      return <span className="text-sm">⭐</span>;
    case "par":
      return <span className="text-sm">🎯</span>;
    case "project":
      return <span className="text-sm">💼</span>;
    case "prep":
      return <span className="text-sm">📋</span>;
    default:
      return <span className="text-sm">⌨</span>;
  }
}
