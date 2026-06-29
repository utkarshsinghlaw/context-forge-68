import { useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listDocuments, createDocument, deleteDocument } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Loader2, UploadCloud } from "lucide-react";
import { format } from "date-fns";
import { PanelEmpty } from "./panel-empty";
import {
  ACCEPTED_EXTENSIONS,
  isAcceptedFile,
  parseFile,
} from "@/lib/ingest";

const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");

export function DocumentsPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["documents", workspaceId];
  const { data: docs = [], isLoading } = useQuery({ queryKey: key, queryFn: () => listDocuments(workspaceId) });
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ingestFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const accepted = list.filter(isAcceptedFile);
    const rejected = list.length - accepted.length;
    if (rejected > 0) toast.error(`${rejected} file(s) skipped — unsupported type`);
    if (accepted.length === 0) return;

    setUploading(true);
    let ok = 0;
    for (const file of accepted) {
      try {
        const parsed = await parseFile(file);
        await createDocument(workspaceId, {
          title: parsed.title,
          content: parsed.text,
          file_type: parsed.fileType,
        });
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "could not import"}`);
      }
    }
    setUploading(false);
    if (ok > 0) {
      toast.success(`Imported ${ok} document${ok > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: key });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reference material ingested into this workspace.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Paste text
          </Button>
          <Button variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload files
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) ingestFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files) ingestFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50"
        }`}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {uploading ? "Importing…" : "Drop files here or click to upload"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, Markdown, TXT, CSV, JSON, HTML · up to 25&nbsp;MB each
        </p>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="mt-6">
          <PanelEmpty
            icon={FileText}
            title="No documents yet"
            body="Upload PDFs, briefs and articles, or paste text directly. They become searchable context for this workspace."
            action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Paste text</Button>}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <div key={d.id} className="group rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <FileText className="h-4 w-4" />
                </span>
                <button
                  onClick={async () => {
                    await deleteDocument(d.id);
                    qc.invalidateQueries({ queryKey: key });
                  }}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete document"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              <h4 className="mt-3 truncate font-medium">{d.title}</h4>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {d.content?.slice(0, 120) || "No content"}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {d.file_type.toUpperCase()} · {format(new Date(d.created_at), "MMM d, yyyy")}
              </p>
            </div>
          ))}
        </div>
      )}

      <AddDocDialog
        workspaceId={workspaceId}
        open={open}
        onOpenChange={setOpen}
        onAdded={() => qc.invalidateQueries({ queryKey: key })}
      />
    </div>
  );
}

function AddDocDialog({
  workspaceId,
  open,
  onOpenChange,
  onAdded,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const add = useMutation({
    mutationFn: () => createDocument(workspaceId, { title: title.trim(), content }),
    onSuccess: () => {
      toast.success("Document added");
      onAdded();
      onOpenChange(false);
      setTitle("");
      setContent("");
    },
    onError: () => toast.error("Could not add document"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add document</DialogTitle>
          <DialogDescription>Paste content to make it searchable in this workspace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Case brief — Smith v. Jones" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-content">Content</Label>
            <Textarea id="doc-content" value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Paste text here…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!title.trim() || add.isPending} onClick={() => add.mutate()}>
            {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}