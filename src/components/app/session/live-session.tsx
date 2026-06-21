import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  getSession,
  listTurns,
  createTurn,
  endSession,
  type SessionTurn,
} from "@/lib/api";
import { transcribeTurn, suggestAnswer, type SuggestCitation } from "@/lib/session.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mic, Square, Loader2, Sparkles, StickyNote, FileText, Brain, User,
  Radio, CheckCircle2, CornerDownLeft, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sourceIcon: Record<string, typeof StickyNote> = {
  note: StickyNote,
  document: FileText,
  memory: Brain,
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function LiveSession({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const transcribeFn = useServerFn(transcribeTurn);
  const suggestFn = useServerFn(suggestAnswer);

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getSession(sessionId),
  });
  const turnsKey = ["session-turns", sessionId];
  const { data: turns = [] } = useQuery({
    queryKey: turnsKey,
    queryFn: () => listTurns(sessionId),
    refetchInterval: (query) =>
      query.state.data && (session?.status === "ended" || ending) ? false : 4000,
  });

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [ending, setEnding] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Tear down any in-flight capture so callbacks don't update an
      // unmounted component after navigation.
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.ondataavailable = null;
        rec.onstop = null;
        try {
          rec.stop();
        } catch {
          /* recorder already stopped */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  const refresh = () => {
    if (mountedRef.current) qc.invalidateQueries({ queryKey: turnsKey });
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Microphone access is needed to capture audio.");
      return;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) {
      stream.getTracks().forEach((t) => t.stop());
      toast.error("This browser can't record a supported audio format.");
      return;
    }
    streamRef.current = stream;
    const rec = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const blob = new Blob(chunksRef.current, { type: rec.mimeType });
      if (blob.size < 1024) {
        if (mountedRef.current) toast.error("That recording was empty — please try again.");
        return;
      }
      if (!mountedRef.current) return;
      setBusy(true);
      try {
        const audioBase64 = await blobToBase64(blob);
        const { text } = await transcribeFn({ data: { audioBase64, mimeType: blob.type } });
        if (!mountedRef.current) return;
        if (!text) {
          toast.error("Couldn't hear anything in that clip.");
          return;
        }
        await createTurn(sessionId, "speaker", text);
        refresh();
      } catch (e) {
        if (mountedRef.current) toast.error((e as Error).message || "Transcription failed");
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const suggest = useMutation({
    mutationFn: (prompt: string) =>
      suggestFn({ data: { sessionId, workspaceId: session!.workspace_id, prompt } }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message || "Couldn't generate a suggestion"),
  });

  const lastSpeaker = [...turns].reverse().find((t) => t.role === "speaker");

  const addNote = async () => {
    const c = draft.trim();
    if (!c) return;
    await createTurn(sessionId, "note", c);
    setDraft("");
    refresh();
  };

  const end = useMutation({
    mutationFn: () => {
      setEnding(true);
      return endSession(session!);
    },
    onSuccess: () => {
      toast.success("Session ended and archived to workspace knowledge");
      qc.invalidateQueries({ queryKey: ["session", sessionId] });
      qc.invalidateQueries({ queryKey: ["sessions", session!.workspace_id] });
      navigate({ to: "/w/$workspaceId", params: { workspaceId: session!.workspace_id } });
    },
    onError: (e: Error) => {
      setEnding(false);
      toast.error(e.message || "Couldn't end session");
    },
  });

  if (isLoading || !session) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ended = session.status === "ended";

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-3xl flex-col px-6 py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/w/$workspaceId", params: { workspaceId: session.workspace_id } })}
            aria-label="Back to workspace"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{session.title}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              {ended ? (
                <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Ended</Badge>
              ) : (
                <Badge className="gap-1 bg-destructive text-destructive-foreground"><Radio className="h-3 w-3 animate-pulse" /> Live</Badge>
              )}
            </div>
          </div>
        </div>
        {!ended && (
          <Button variant="outline" onClick={() => end.mutate()} disabled={end.isPending}>
            {end.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
            End session
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4">
        {turns.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Mic className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Record what's being said, then ask Interview Buddy for a grounded answer.
              </p>
            </div>
          </div>
        ) : (
          turns.map((t) => <TurnBubble key={t.id} turn={t} />)
        )}
        {suggest.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Drafting a grounded answer…
          </div>
        )}
      </div>

      {!ended && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {recording ? (
              <Button onClick={stopRecording} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Square className="h-4 w-4" /> Stop &amp; transcribe
              </Button>
            ) : (
              <Button onClick={startRecording} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                Record
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={suggest.isPending || (!lastSpeaker && !draft.trim())}
              onClick={() => suggest.mutate(draft.trim() || lastSpeaker?.content || "")}
            >
              <Sparkles className="h-4 w-4" /> Suggest answer
            </Button>
            {recording && (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Recording…
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Type a question to answer, or jot a note…"
              className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Suggest uses this text, or the last thing recorded</span>
              <Button size="sm" variant="ghost" onClick={addNote} disabled={!draft.trim()}>
                <CornerDownLeft className="h-4 w-4" /> Save as note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TurnBubble({ turn }: { turn: SessionTurn }) {
  if (turn.role === "assistant") {
    const citations = (turn.citations as unknown as SuggestCitation[] | null) ?? [];
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Suggested answer
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.content}</p>
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {citations.map((c, i) => {
              const Icon = sourceIcon[c.source_type] ?? FileText;
              return (
                <span key={`${c.source_id}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                  <Icon className="h-3 w-3" /> [{i + 1}] {c.source_title || "Untitled"}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (turn.role === "note") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2 text-sm">
        <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <span>{turn.content}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-background text-muted-foreground">
        <User className="h-3.5 w-3.5" />
      </span>
      <span className="leading-relaxed">{turn.content}</span>
    </div>
  );
}
