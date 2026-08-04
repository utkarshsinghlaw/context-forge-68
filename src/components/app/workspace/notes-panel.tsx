import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listNotes, createNote, updateNote, deleteNote, type Note } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pin, PinOff, Trash2, Loader2, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { PanelEmpty } from "./panel-empty";

export function NotesPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["notes", workspaceId];
  const { data: notes = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listNotes(workspaceId),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createNote(workspaceId),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: key });
      setSelectedId(n.id);
    },
  });

  const selected = notes.find((n) => n.id === selectedId) ?? notes[0] ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <Button
          className="w-full"
          variant="outline"
          onClick={() => create.mutate()}
          disabled={create.isPending}
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New note
        </Button>
        {isLoading ? (
          <ListSkeleton />
        ) : notes.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <div className="space-y-1">
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                  selected?.id === n.id
                    ? "border-primary bg-accent"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                  <span className="truncate text-sm font-medium">{n.title || "Untitled"}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {n.content?.slice(0, 60) || "Empty note"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected ? (
        <NoteEditor
          key={selected.id}
          note={selected}
          onChanged={() => qc.invalidateQueries({ queryKey: key })}
          onDeleted={() => {
            setSelectedId(null);
            qc.invalidateQueries({ queryKey: key });
          }}
        />
      ) : (
        <PanelEmpty
          icon={StickyNote}
          title="Capture your thinking"
          body="Notes are private to this workspace and feed your workspace memory."
          action={
            <Button onClick={() => create.mutate()}>
              <Plus className="h-4 w-4" /> New note
            </Button>
          }
        />
      )}
    </div>
  );
}

function NoteEditor({
  note,
  onChanged,
  onDeleted,
}: {
  note: Note;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateNote(note.id, { title: title.trim() || "Untitled", content });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async () => {
    await updateNote(note.id, { pinned: !note.pinned });
    onChanged();
  };

  const remove = async () => {
    await deleteNote(note.id);
    toast.success("Note deleted");
    onDeleted();
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          placeholder="Untitled"
        />
        <Button variant="ghost" size="icon" onClick={togglePin} aria-label="Pin">
          {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={remove} aria-label="Delete">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={save}
        placeholder="Start writing…"
        className="mt-2 min-h-[320px] resize-none border-0 px-0 shadow-none focus-visible:ring-0"
      />
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Edited {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
