import { requireServerKey } from "@/lib/env";

export class EmbeddingService {
  async embed(text: string): Promise<number[]> {
    const apiKey = requireServerKey("OPENROUTER_API_KEY", "OpenRouter");

    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) {
      // Fallback: simple hash-based pseudo-embedding for dev without API
      return this.fallbackEmbed(text);
    }

    const data = await res.json();
    return data.data?.[0]?.embedding ?? this.fallbackEmbed(text);
  }

  private fallbackEmbed(text: string): number[] {
    const vec = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 1536] += text.charCodeAt(i) / 255;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

export const embeddingService = new EmbeddingService();
