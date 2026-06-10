import { GEMINI_35_FLASH_MODEL, sendChatCompletion, streamChatCompletion } from "@/lib/openrouter";
import type { ChatResult } from "@openrouter/sdk/models";
import type { RAGContext } from "@/types/domain";

const SENSITIVE_TOPICS = [
  "price", "pricing", "cost", "area", "possession", "rera", "legal",
  "bank", "loan", "tax", "offer", "discount", "availability", "booking", "refund",
];

const SYSTEM_PROMPT = `You are a real estate sales AI agent. Answer ONLY from the provided property context.
Never invent prices, areas, possession dates, RERA status, legal approvals, bank approvals, loan terms, tax, offers, discounts, availability, booking amounts, or refund terms.
If context is insufficient, respond: "I do not have that exact information in the developer-approved property data. I can connect you with the sales team to confirm it."
Keep answers concise and helpful. If buyer asks to navigate, respond with JSON navigation intent in format: {"navigate":"room_id_or_checkpoint_id"}.`;

export class OpenRouterService {
  private get model() {
    return process.env.OPENROUTER_PRIMARY_MODEL ?? GEMINI_35_FLASH_MODEL;
  }

  async chat(params: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    stream?: false;
  }): Promise<ChatResult>;
  async chat(params: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    stream: true;
  }): ReturnType<typeof streamChatCompletion>;
  async chat(params: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    temperature?: number;
    stream?: boolean;
  }) {
    if (params.stream) {
      return streamChatCompletion({
        model: this.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.15,
      });
    }

    return sendChatCompletion({
      model: this.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.15,
    });
  }

  buildGroundedMessages(query: string, contexts: RAGContext[], sceneContext?: string) {
    const contextBlock = contexts
      .map((c) => `[${c.category}] ${c.title}: ${c.content}`)
      .join("\n\n");

    return [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "user" as const,
        content: `Property context:\n${contextBlock || "No approved context available."}\n\nCurrent scene: ${sceneContext ?? "unknown"}\n\nBuyer question: ${query}`,
      },
    ];
  }

  isSensitiveQuery(query: string): boolean {
    const lower = query.toLowerCase();
    return SENSITIVE_TOPICS.some((t) => lower.includes(t));
  }

  computeConfidence(contexts: RAGContext[], query: string): number {
    if (!contexts.length) return 0;
    const avg = contexts.reduce((s, c) => s + c.score, 0) / contexts.length;
    const sensitive = this.isSensitiveQuery(query);
    if (sensitive && avg < 0.7) return Math.min(avg, 0.4);
    return avg;
  }

  shouldFallback(contexts: RAGContext[], query: string): boolean {
    if (!contexts.length) return true;
    if (this.isSensitiveQuery(query) && this.computeConfidence(contexts, query) < 0.6) return true;
    return false;
  }
}

export const openRouterService = new OpenRouterService();
