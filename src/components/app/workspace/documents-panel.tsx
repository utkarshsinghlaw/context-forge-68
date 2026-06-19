import { useState } from "react";
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

export function DocumentsPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["documents", workspaceId];
  const { data: docs = [], isLoading } = useQuery({ queryKey: key, queryFn: () => listDocuments(workspaceId) });
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reference material ingested into this workspace.
        </p>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <UploadCloud className="h-4 w-4" /> Add document
        </Button>
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
            body="Paste text or notes from PDFs, briefs and articles. They become searchable context for this workspace."
            action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add document</Button>}
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