import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DeepgramClient } from "@deepgram/sdk";

export const getDeepgramToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Rate limit Deepgram token generation
    const { data: isAllowed, error: rlError } = await supabase.rpc("check_rate_limit", {
      p_user_id: userId,
      p_endpoint: "deepgramToken",
      p_limit: 20,
      p_window_seconds: 3600,
    } as any);
    if (rlError) throw new Error(rlError.message);
    if (!isAllowed) throw new Error("Rate limit exceeded for token generation.");

    const apiKey = process.env.DEEPGRAM_API_KEY;
    const projectId = process.env.DEEPGRAM_PROJECT_ID;

    if (!apiKey || !projectId) {
      throw new Error("Deepgram credentials not configured on server.");
    }

    const deepgram = new DeepgramClient({ apiKey });
    try {
      const response = await deepgram.manage.v1.projects.keys.create(projectId, {
        comment: `temp-session-${userId}`,
        scopes: ["usage:write"],
        time_to_live_in_seconds: 3600,
      });

      if (!response.key) {
        throw new Error("Deepgram returned no key.");
      }

      return { token: response.key };
    } catch (error: any) {
      throw new Error(`Failed to generate Deepgram token: ${error?.message || String(error)}`);
    }
  });
