import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReviewCard = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  source_type: "note" | "document" | "memory";
  source_id: string;
  front: string;
  back: string;
  status: "new" | "learning" | "review" | "suspended";
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ReviewRating = "again" | "hard" | "good" | "easy";

const stripHtml = (html: string) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

/* --------------------------- Card generation --------------------------- */

const GenerateInput = z.object({
  sourceType: z.enum(["note", "document", "memory"]),
  sourceId: z.string().uuid(),
});

interface RawCard {
  front: string;
  back: string;
}

export const generateCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { sourceType, sourceId } = data;

    const table =
      sourceType === "note" ? "notes" : sourceType === "document" ? "documents" : "memory_entries";
    const { data: row } = await supabase
      .from(table)
      .select("id,title,content,workspace_id")
      .eq("id", sourceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!row) throw new Error("Source not found.");

    const title = (row as { title?: string }).title ?? "";
    const content = stripHtml((row as { content?: string }).content ?? "");
    const workspaceId = (row as { workspace_id?: string | null }).workspace_id ?? null;

    if (!content.trim() || content.trim().length < 40) {
      throw new Error("Add more content to this source before generating cards.");
    }

    const { chatComplete } = await import("@/lib/ai-gateway.server");

    const system =
      "You are Interview Buddy's spaced-repetition engine. Given a source title and content, " +
      "extract 3 to 8 high-yield review cards. Each card tests one fact, definition, or concept. " +
      "Return ONLY valid JSON conforming to { cards: [{ front: string, back: string }] }. " +
      "Front is the question/prompt; back is a concise, correct answer.";

    const prompt = `TITLE: ${title}\n\nCONTENT:\n${content.slice(0, 6000)}`;
    const raw = await chatComplete([
      { role: "system", content: system },
      { role: "user", content: prompt },
    ]);

    let cards: RawCard[] = [];
    try {
      const cleaned = raw
        .replace(/```(?:json)?\s*([\s\S]*?)```/, "$1")
        .trim();
      const parsed = JSON.parse(cleaned);
      cards = Array.isArray(parsed.cards) ? parsed.cards : parsed;
      if (!Array.isArray(cards)) throw new Error("Invalid shape");
      cards = cards
        .filter((c) => c && typeof c.front === "string" && typeof c.back === "string")
        .map((c) => ({ front: c.front.trim(), back: c.back.trim() }));
    } catch {
      throw new Error("The AI did not return parsable card data. Try again.");
    }

    if (cards.length === 0) {
      throw new Error("No usable cards could be generated from this source.");
    }

    const insert = cards.map((c) => ({
      user_id: userId,
      workspace_id: workspaceId,
      source_type: sourceType,
      source_id: sourceId,
      front: c.front,
      back: c.back,
      status: "new" as const,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      lapses: 0,
      due_date: null,
    }));

    const { data: created, error } = await supabase
      .from("review_cards")
      .insert(insert)
      .select("*");

    if (error) throw new Error(error.message);
    return { cards: (created ?? []) as ReviewCard[] };
  });

/* ------------------------------ Queries ------------------------------- */

const WorkspaceOptional = z.object({ workspaceId: z.string().uuid().optional() });

export const listDueCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WorkspaceOptional.parse(input))
  .handler(async ({ data, context }): Promise<ReviewCard[]> => {
    const { supabase } = context;
    let q = supabase
      .from("review_cards")
      .select("*")
      .neq("status", "suspended")
      .order("created_at", { ascending: false });

    if (data.workspaceId) {
      q = q.eq("workspace_id", data.workspaceId);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const today = new Date().toISOString().slice(0, 10);
    return ((rows ?? []) as ReviewCard[]).filter(
      (c) => c.status === "new" || !c.due_date || c.due_date <= today,
    );
  });

export const listCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WorkspaceOptional.parse(input))
  .handler(async ({ data, context }): Promise<ReviewCard[]> => {
    const { supabase } = context;
    let q = supabase.from("review_cards").select("*").order("updated_at", { ascending: false });
    if (data.workspaceId) {
      q = q.eq("workspace_id", data.workspaceId);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ReviewCard[];
  });

export const deleteCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cardId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("review_cards")
      .delete()
      .eq("id", data.cardId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ Review ------------------------------- */

const ReviewInput = z.object({
  cardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

function nextSm2(
  rating: ReviewRating,
  status: ReviewCard["status"],
  repetitions: number,
  intervalDays: number,
  easeFactor: number,
): {
  status: ReviewCard["status"];
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
  lapses: number;
} {
  let nextReps = repetitions;
  let nextInterval = intervalDays;
  let nextEase = easeFactor;
  let nextStatus: ReviewCard["status"] = status === "new" ? "learning" : "review";
  let lapsesInc = 0;

  if (rating === "again") {
    nextReps = 0;
    nextInterval = 1;
    nextEase = Math.max(1.3, easeFactor - 0.2);
    lapsesInc = status === "new" ? 0 : 1;
    nextStatus = "learning";
  } else if (rating === "hard") {
    nextReps += 1;
    if (nextReps === 1) nextInterval = 1;
    else if (nextReps === 2) nextInterval = 3;
    else nextInterval = Math.max(1, Math.round(intervalDays * 1.2));
    nextEase = Math.max(1.3, easeFactor - 0.15);
  } else if (rating === "good") {
    nextReps += 1;
    if (nextReps === 1) nextInterval = 1;
    else if (nextReps === 2) nextInterval = 3;
    else nextInterval = Math.max(1, Math.round(intervalDays * easeFactor));
  } else if (rating === "easy") {
    nextReps += 1;
    if (nextReps === 1) nextInterval = 2;
    else if (nextReps === 2) nextInterval = 4;
    else nextInterval = Math.max(1, Math.round(intervalDays * easeFactor * 1.3));
    nextEase = easeFactor + 0.15;
  }

  return {
    status: nextStatus,
    repetitions: nextReps,
    intervalDays: nextInterval,
    easeFactor: nextEase,
    lapses: lapsesInc,
  };
}

export const reviewCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { cardId, rating } = data;

    const { data: card, error: fetchError } = await supabase
      .from("review_cards")
      .select("*")
      .eq("id", cardId)
      .eq("user_id", userId)
      .single();
    if (fetchError) throw new Error(fetchError.message);

    const next = nextSm2(
      rating,
      card.status as ReviewCard["status"],
      card.repetitions,
      card.interval_days,
      card.ease_factor,
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + next.intervalDays);

    const { error: updateError } = await supabase
      .from("review_cards")
      .update({
        status: next.status,
        repetitions: next.repetitions,
        interval_days: next.intervalDays,
        ease_factor: next.easeFactor,
        lapses: card.lapses + next.lapses,
        due_date: dueDate.toISOString().slice(0, 10),
      })
      .eq("id", cardId);

    if (updateError) throw new Error(updateError.message);

    const { error: logError } = await supabase.from("review_logs").insert({
      user_id: userId,
      card_id: cardId,
      rating,
      old_interval: card.interval_days,
      new_interval: next.intervalDays,
      old_ease_factor: card.ease_factor,
      new_ease_factor: next.easeFactor,
    });

    if (logError) throw new Error(logError.message);

    return { ok: true };
  });
