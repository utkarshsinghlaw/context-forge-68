import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Calendar, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export function MeetingsPanel({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  
  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings" as any)
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const handleCreateMeeting = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not logged in");

      const { data: newMeeting, error } = await supabase
        .from("meetings" as any)
        .insert({
          workspace_id: workspaceId,
          user_id: user.user.id,
          title: "New Meeting - " + new Date().toLocaleDateString(),
        })
        .select()
        .single();

      if (error) throw error;
      
      navigate({ 
        to: `/w/$workspaceId/meetings/$meetingId`, 
        params: { workspaceId, meetingId: newMeeting.id } 
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to create meeting");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Meetings</h2>
        <Button onClick={handleCreateMeeting} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Meeting
        </Button>
      </div>

      {!meetings || meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Video className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No meetings yet</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Record meetings to automatically generate transcripts and make them searchable within your workspace.
          </p>
          <Button onClick={handleCreateMeeting} className="mt-6">
            <Plus className="mr-2 h-4 w-4" /> Start your first meeting
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              to="/w/$workspaceId/meetings/$meetingId"
              params={{ workspaceId, meetingId: meeting.id }}
              className="group relative flex cursor-pointer flex-col justify-between rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md block"
            >
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{formatDistanceToNow(new Date(meeting.created_at), { addSuffix: true })}</span>
              </div>
              <h3 className="font-medium line-clamp-2 leading-tight">
                {meeting.title || "Untitled Meeting"}
              </h3>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                {meeting.summary || meeting.transcript || "No transcript available yet."}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
