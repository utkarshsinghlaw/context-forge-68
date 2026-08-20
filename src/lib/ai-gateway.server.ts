/**
 * Server-only helpers for the Lovable AI Gateway.
 * These read LOVABLE_API_KEY and must never be imported by client code.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
export const CHAT_MODEL = "google/gemini-3-flash-preview";

function apiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "GatewayError";
  }
}

function friendlyError(status: number, body: string): GatewayError {
  if (status === 402)
    return new GatewayError(
      402,
      "AI credits exhausted. Add credits to continue using AI features.",
    );
  if (status === 429)
    return new GatewayError(429, "AI is rate limited right now. Please try again in a moment.");
  if (status === 403) return new GatewayError(403, "AI is not enabled for this workspace.");
  return new GatewayError(status, `AI request failed (${status}): ${body.slice(0, 300)}`);
}

/** Embed up to a batch of strings. Returns one vector per input, in order. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) throw friendlyError(res.status, await res.text());
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function embedOne(input: string): Promise<number[]> {
  const [vec] = await embedTexts([input]);
  return vec;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Non-streaming chat completion. Returns the assistant text. */
export async function chatComplete(messages: ChatMessage[], model: string = CHAT_MODEL): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) throw friendlyError(res.status, await res.text());
  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return json.choices[0]?.message?.content ?? "";
}

/**
 * Open a streaming chat completion. Returns the raw SSE Response from the
 * gateway; callers parse the `data:` deltas. Throws a friendly error on
 * non-2xx so the route can surface it before streaming begins.
 */
export async function openChatStream(messages: ChatMessage[], model: string = CHAT_MODEL): Promise<Response> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, stream: true }),
  });
  if (!res.ok || !res.body) throw friendlyError(res.status, await res.text());
  return res;
}

/**
 * Transform a gateway SSE stream into a plain-text token stream of the
 * assistant's `delta.content`. Safe to pipe straight to the browser.
 * If the upstream emits an error frame mid-stream, the stream is errored so
 * the client's reader rejects instead of silently ending with a partial answer.
 */
export function sseToTextStream(upstream: Response): ReadableStream<Uint8Array> {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let emitted = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (!emitted) {
            controller.error(new Error("The AI returned an empty response. Please try again."));
            return;
          }
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") {
            if (!emitted) {
              controller.error(new Error("The AI returned an empty response. Please try again."));
              return;
            }
            controller.close();
            return;
          }
          let json: {
            choices?: { delta?: { content?: string } }[];
            error?: { message?: string };
          };
          try {
            json = JSON.parse(payload);
          } catch {
            continue; // partial/keepalive frame
          }
          if (json.error) {
            controller.error(new Error(json.error.message || "AI streaming failed"));
            return;
          }
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            emitted = true;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch (err) {
        controller.error(err instanceof Error ? err : new Error("AI streaming failed"));
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}
