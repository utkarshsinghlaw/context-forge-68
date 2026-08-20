import { chatComplete, type ChatMessage } from "./ai-gateway.server";

export type Role = "CODER" | "LIBRARIAN" | "ASSISTANT";
export type MemoryRequirement = "NONE" | "WORKING_MEMORY" | "LONG_TERM_RAG";

export interface ClassificationResult {
  role: Role;
  memory_requirement: MemoryRequirement;
}

// A fast model to determine routing
const CLASSIFIER_MODEL = "google/gemini-1.5-flash"; 

const SYSTEM_PROMPT = `You are the AI Router for Context Forge. Your job is to classify the user's prompt.
You MUST output ONLY a valid JSON object with no markdown formatting or extra text.

Fields:
- "role": Who should answer this?
  - "CODER" for complex tasks, programming, logic, or multi-step reasoning.
  - "LIBRARIAN" for requests to search documents, recall past meetings, or summarize data.
  - "ASSISTANT" for simple greetings, casual chat, or basic formatting.
- "memory_requirement": What context is needed?
  - "NONE" for simple greetings or generic questions that don't need context.
  - "WORKING_MEMORY" for follow-up questions about the active conversation or task.
  - "LONG_TERM_RAG" for questions asking "What did we decide last week?", "Search my notes", or "Look up X in my documents".

Example output:
{"role": "LIBRARIAN", "memory_requirement": "LONG_TERM_RAG"}
`;

export async function classifyPrompt(prompt: string, historyLength: number): Promise<ClassificationResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `History Length: ${historyLength}\nPrompt: ${prompt}` }
  ];

  try {
    const rawResponse = await chatComplete(messages, CLASSIFIER_MODEL);
    // Strip markdown blocks if the model included them despite instructions
    const cleaned = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned) as ClassificationResult;
    
    // Validate output, fallback to safe defaults if hallucinated
    const validRoles = ["CODER", "LIBRARIAN", "ASSISTANT"];
    const validMemory = ["NONE", "WORKING_MEMORY", "LONG_TERM_RAG"];
    
    if (!validRoles.includes(result.role)) result.role = "ASSISTANT";
    if (!validMemory.includes(result.memory_requirement)) result.memory_requirement = "LONG_TERM_RAG";
    
    return result;
  } catch (error) {
    console.error("Classification failed, falling back to default:", error);
    // Fallback to the most robust context configuration if the classifier fails
    return { role: "CODER", memory_requirement: "LONG_TERM_RAG" };
  }
}
