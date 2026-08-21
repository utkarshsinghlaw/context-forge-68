import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Video, Settings2, Mic, Square, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { getDeepgramToken } from "@/lib/deepgram.functions";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/w_/$workspaceId/meetings/$meetingId"
)({
  component: MeetingRoomPage,
});

function MeetingRoomPage() {
  const { workspaceId, meetingId } = Route.useParams();
  const qc = useQueryClient();

  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings" as any)
        .select("*")
        .eq("id", meetingId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const updateMeeting = useMutation({
    mutationFn: async (transcript: string) => {
      const { error } = await supabase
        .from("meetings" as any)
        .update({ transcript })
        .eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
      toast.success("Transcript saved!");
    },
  });

  const startRecording = async () => {
    try {
      const { token } = await getDeepgramToken();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      const socket = new WebSocket("wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", [
        "token",
        token,
      ]);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsRecording(true);
        mediaRecorder.addEventListener("dataavailable", (e) => {
          if (e.data.size > 0 && socket.readyState === 1) {
            socket.send(e.data);
          }
        });
        mediaRecorder.start(250); // Send chunks every 250ms
      };

      socket.onmessage = (message) => {
        const received = JSON.parse(message.data);
        const transcriptChunk = received?.channel?.alternatives?.[0]?.transcript;
        if (transcriptChunk && received.is_final) {
          setLiveTranscript((prev) => prev + (prev ? " " : "") + transcriptChunk);
        }
      };

      socket.onerror = () => {
        toast.error("Error connecting to transcription service.");
        stopRecording();
      };
    } catch (e: any) {
      toast.error(e.message || "Failed to start recording");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
  };

  const handleSave = () => {
    if (meeting) {
      // Append the new live transcript to the old one if it exists
      const finalTranscript = meeting.transcript 
        ? meeting.transcript + "\n\n" + liveTranscript 
        : liveTranscript;
      
      updateMeeting.mutate(finalTranscript);
      setLiveTranscript(""); // Reset live portion after save
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-bold text-muted-foreground">Meeting not found</h1>
        <Button asChild>
          <Link to="/w/$workspaceId" params={{ workspaceId }} search={{ tab: "meetings" }}>
            Return to Workspace
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/w/$workspaceId" params={{ workspaceId }} search={{ tab: "meetings" }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Video className="h-4 w-4" />
            </div>
            <h1 className="text-sm font-medium tracking-tight sm:text-base">
              {meeting.title || "Untitled Meeting"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <Button onClick={startRecording} variant="default" size="sm" className="gap-2">
              <Mic className="h-4 w-4" />
              Start Recording
            </Button>
          ) : (
            <Button onClick={stopRecording} variant="destructive" size="sm" className="gap-2 animate-pulse">
              <Square className="h-4 w-4 fill-current" />
              Stop Recording
            </Button>
          )}
          {liveTranscript && !isRecording && (
            <Button onClick={handleSave} variant="secondary" size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              Save Transcript
            </Button>
          )}
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 overflow-auto p-4 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Transcript
              {isRecording && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />}
            </h2>
            <div className="mt-4 prose prose-sm dark:prose-invert max-w-none">
              {meeting.transcript && (
                <div className="mb-4 whitespace-pre-wrap text-muted-foreground border-b pb-4">
                  {meeting.transcript}
                </div>
              )}
              
              {liveTranscript && (
                <p className="whitespace-pre-wrap text-foreground">
                  {liveTranscript}
                </p>
              )}

              {!meeting.transcript && !liveTranscript && !isRecording && (
                <p className="text-muted-foreground italic">No transcript recorded yet. Click "Start Recording" to begin capturing.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
