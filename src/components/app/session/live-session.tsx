import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { getSession, listTurns, createTurn, endSession, type SessionTurn } from "@/lib/api";
import { transcribeTurn, type SuggestCitation } from "@/lib/session.functions";
import { getDeepgramToken } from "@/lib/deepgram.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Mic,
  Square,
  Loader2,
  Sparkles,
  StickyNote,
  FileText,
  Brain,
  User,
  Radio,
  CheckCircle2,
  CornerDownLeft,
  ArrowLeft,
  MonitorSmartphone
} from "lucide-react";
import { cn } from "@/lib/utils";

const sourceIcon: Record<string, typeof StickyNote> = {
  note: StickyNote,
  document: FileText,
  memory: Brain,
};

function decodeCitations(header: string | null): SuggestCitation[] {
  if (!header) return [];
  try {
    const bytes = Uint8Array.from(atob(header), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as SuggestCitation[];
  } catch {
    return [];
  }
}

export function LiveSession({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getTokenFn = useServerFn(getDeepgramToken);

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
  const [audioSource, setAudioSource] = useState<"mic" | "system" | "both">("mic");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [draft, setDraft] = useState("");
  const [ending, setEnding] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [suggestCitations, setSuggestCitations] = useState<SuggestCitation[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRecording();
      suggestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, suggestion, interimTranscript]);

  const refresh = () => {
    if (mountedRef.current) qc.invalidateQueries({ queryKey: turnsKey });
  };

  const startRecording = async () => {
    if (recording) return;

    let micStream: MediaStream | null = null;
    let sysStream: MediaStream | null = null;
    let finalStream: MediaStream | null = null;

    try {
      if (audioSource === "mic" || audioSource === "both") {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (audioSource === "system" || audioSource === "both") {
        sysStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      }

      if (audioSource === "both" && micStream && sysStream) {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(dest);
        ctx.createMediaStreamSource(sysStream).connect(dest);
        finalStream = dest.stream;
      } else {
        finalStream = micStream || sysStream;
      }
      
      if (!finalStream) throw new Error("No audio stream available");

      streamRef.current = new MediaStream([
        ...finalStream.getAudioTracks(),
        ...(sysStream ? sysStream.getVideoTracks() : [])
      ]);
    } catch (e) {
      toast.error("Could not capture selected audio sources.");
      micStream?.getTracks().forEach(t => t.stop());
      sysStream?.getTracks().forEach(t => t.stop());
      return;
    }

    if (!mountedRef.current) return;

    try {
      const { token } = await getTokenFn();
      
      const ws = new WebSocket('wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true', ['token', token]);
      wsRef.current = ws;

      ws.onopen = () => {
        const mimeType = ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "audio/webm";
        const rec = new MediaRecorder(finalStream!, { mimeType });
        
        rec.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };
        
        rec.start(250);
        recorderRef.current = rec;
        if (mountedRef.current) setRecording(true);
      };

      ws.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcript = received.channel?.alternatives[0]?.transcript;
        if (transcript) {
          if (received.is_final) {
            createTurn(sessionId, "speaker", transcript).then(() => refresh());
            setInterimTranscript("");
          } else {
            setInterimTranscript(transcript);
          }
        }
      };

      ws.onerror = () => {
        toast.error("Deepgram connection error");
        stopRecording();
      };
      
      ws.onclose = () => {
        if (mountedRef.current && recording) stopRecording();
      };

    } catch (e) {
      toast.error("Failed to connect to Deepgram: " + (e as Error).message);
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setInterimTranscript("");
    if (mountedRef.current) setRecording(false);
  };

  const suggest = async (prompt: string) => {
    const p = prompt.trim();
    if (!p || suggesting || !session) return;
    setSuggesting(true);
    setSuggestion("");
    setSuggestCitations([]);
    const controller = new AbortController();
    suggestAbortRef.current = controller;
    let acc = "";
    let cites: SuggestCitation[] = [];
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      const res = await fetch("/api/session-suggest", {
        method: "POST",
        // FIXED: Wrapped Bearer ${token} in backticks. Previosuly it was missing backticks which caused a ReferenceError
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workspaceId: session.workspace_id, prompt: p }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error((await res.text().catch(() => "")) || "Couldn't generate a suggestion");
      }
      cites = decodeCitations(res.headers.get("x-citations"));
      if (mountedRef.current) setSuggestCitations(cites);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (mountedRef.current) setSuggestion(acc);
      }
      if (!acc.trim()) throw new Error("The AI returned an empty answer. Please try again.");
      await createTurn(sessionId, "assistant", acc, cites);
      if (mountedRef.current) {
        setSuggestion("");
        setSuggestCitations([]);
        refresh();
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error((e as Error).message || "Couldn't generate a suggestion");
        if (mountedRef.current) {
          setSuggestion("");
          setSuggestCitations([]);
        }
      }
    } finally {
      if (mountedRef.current) setSuggesting(false);
      suggestAbortRef.current = null;
    }
  };

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
      navigate({ to: "/w/", params: { workspaceId: session!.workspace_id } });
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
            onClick={() =>
              navigate({ to: "/w/", params: { workspaceId: session.workspace_id } })
            }
            aria-label="Back to workspace"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{session.title}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              {ended ? (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Ended
                </Badge>
              ) : (
                <Badge className="gap-1 bg-destructive text-destructive-foreground">
                  <Radio className="h-3 w-3 animate-pulse" /> Live
                </Badge>
              )}
            </div>
          </div>
        </div>
        {!ended && (
          <Button variant="outline" onClick={() => end.mutate()} disabled={end.isPending}>
            {end.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            End session
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card/40 p-4"
      >
        {turns.length === 0 && !interimTranscript ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Mic className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Start live capture, then ask Interview Buddy for a grounded answer.
              </p>
            </div>
          </div>
        ) : (
          turns.map((t) => <TurnBubble key={t.id} turn={t} />)
        )}
        
        {interimTranscript && (
          <div className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm opacity-70">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-background text-muted-foreground">
              <User className="h-3.5 w-3.5" />
            </span>
            <span className="leading-relaxed">{interimTranscript}</span>
          </div>
        )}

        {suggesting && !suggestion && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Retrieving context and drafting…
          </div>
        )}
        {suggestion && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Suggested answer
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {suggestion}
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
            </p>
            {suggestCitations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {suggestCitations.map((c, i) => {
                  const Icon = sourceIcon[c.source_type] ?? FileText;
                  return (
                    <span
                      key={`${c.source_id}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      <Icon className="h-3 w-3" /> [{i + 1}] {c.source_title || "Untitled"}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {!ended && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {!recording && (
              <Select value={audioSource} onValueChange={(v: "mic" | "system" | "both") => setAudioSource(v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Audio Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mic"><div className="flex items-center gap-2"><Mic className="h-4 w-4"/> Microphone</div></SelectItem>
                  <SelectItem value="system"><div className="flex items-center gap-2"><MonitorSmartphone className="h-4 w-4"/> System (Teams)</div></SelectItem>
                  <SelectItem value="both"><div className="flex items-center gap-2"><Radio className="h-4 w-4"/> Both (Mixed)</div></SelectItem>
                </SelectContent>
              </Select>
            )}

            {recording ? (
              <Button
                onClick={stopRecording}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Square className="h-4 w-4" /> Stop Capture
              </Button>
            ) : (
              <Button onClick={startRecording}>
                <Radio className="h-4 w-4" /> Start Live Capture
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={suggesting || (!lastSpeaker && !draft.trim())}
              onClick={() => suggest(draft.trim() || lastSpeaker?.content || "")}
            >
              <Sparkles className="h-4 w-4" /> Suggest answer
            </Button>
            {recording && (
              <span className="flex items-center gap-1.5 text-sm text-destructive">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Live Transcribing…
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
              <span className="text-xs text-muted-foreground">
                Suggest uses this text, or the last thing recorded
              </span>
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
                <span
                  key={`${c.source_id}-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                >
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
