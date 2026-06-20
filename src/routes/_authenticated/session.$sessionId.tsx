import { createFileRoute } from "@tanstack/react-router";
import { LiveSession } from "@/components/app/session/live-session";

export const Route = createFileRoute("/_authenticated/session/$sessionId")({
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  return <LiveSession sessionId={sessionId} />;
}
