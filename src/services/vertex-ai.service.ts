import { GoogleGenAI } from "@google/genai";
import { getVertexAIConfig } from "@/lib/platform-settings";
import { env } from "@/lib/env";

const DEFAULT_PLANNER = "gemini-3.5-flash";
const DEFAULT_VIDEO = "veo-3.1-lite-generate-001";

async function getClient() {
  const cfg = await getVertexAIConfig();
  const apiKey = cfg.api_key ?? process.env.GOOGLE_VERTEX_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Vertex AI API key not configured. Set it in Super Admin → Walkthrough AI.");

  if (cfg.project_id) {
    return new GoogleGenAI({
      vertexai: true,
      project: cfg.project_id,
      location: cfg.location ?? "us-central1",
      apiKey,
    });
  }

  // Vertex AI Express mode (API key only — matches Google Cloud console keys)
  return new GoogleGenAI({ vertexai: true, apiKey });
}

export class VertexAIService {
  async planScenes(
    images: { id: string; url: string; file_name: string }[],
    options?: { propertyType?: string; propertyName?: string; promptText?: string },
  ): Promise<string> {
    const cfg = await getVertexAIConfig();
    const ai = await getClient();
    const model = cfg.planner_model ?? DEFAULT_PLANNER;

    const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [
      { text: options?.promptText ?? "Analyze property images and return walkthrough plan JSON." },
    ];

    for (const img of images.slice(0, 12)) {
      try {
        const res = await fetch(img.url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        parts.push({
          inlineData: {
            data: buf.toString("base64"),
            mimeType: res.headers.get("content-type") ?? "image/jpeg",
          },
        });
      } catch {
        parts.push({ text: `Image ${img.file_name} (id=${img.id})` });
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        temperature: 0.2,
      },
    });

    const text = response.text;
    if (!text?.trim()) throw new Error("Vertex AI returned empty planner response");
    return text;
  }

  async submitVideoJob(prompt: string, imageUrl?: string): Promise<{ operationName: string }> {
    const cfg = await getVertexAIConfig();
    const ai = await getClient();
    const model = cfg.video_model ?? DEFAULT_VIDEO;

    let imagePart: { imageBytes: string; mimeType: string } | undefined;
    if (imageUrl) {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to fetch scene image: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      imagePart = {
        imageBytes: buf.toString("base64"),
        mimeType: res.headers.get("content-type") ?? "image/jpeg",
      };
    }

    const operation = await ai.models.generateVideos({
      model,
      source: {
        prompt,
        ...(imagePart ? { image: imagePart } : {}),
      },
      config: {
        numberOfVideos: 1,
        aspectRatio: "16:9",
        durationSeconds: 6,
      },
    });

    const name = operation.name ?? (operation as { operation?: { name?: string } }).operation?.name;
    if (!name) throw new Error("Vertex Veo did not return an operation name");
    return { operationName: name };
  }

  async pollVideoOperation(operationName: string): Promise<{
    status: "processing" | "completed" | "failed";
    videoUri?: string;
    error?: string;
  }> {
    const ai = await getClient();
    const operation = await ai.operations.getVideosOperation({
      operation: { name: operationName } as Parameters<typeof ai.operations.getVideosOperation>[0]["operation"],
    });

    if (!operation.done) {
      return { status: "processing" };
    }

    if (operation.error) {
      return { status: "failed", error: String(operation.error.message ?? operation.error) };
    }

    const video = operation.response?.generatedVideos?.[0]?.video as { uri?: string } | undefined;
    const uri = video?.uri;

    if (!uri) return { status: "failed", error: "No video URI in Vertex response" };
    return { status: "completed", videoUri: uri };
  }

  async downloadVideo(uri: string): Promise<Buffer> {
    const cfg = await getVertexAIConfig();
    const apiKey = cfg.api_key ?? process.env.GOOGLE_VERTEX_API_KEY ?? process.env.GOOGLE_API_KEY;

    if (uri.startsWith("gs://")) {
      throw new Error("GCS video URIs require project storage access — configure output to HTTPS or use OpenRouter");
    }

    const res = await fetch(uri, {
      headers: apiKey ? { "x-goog-api-key": apiKey } : {},
    });
    if (!res.ok) throw new Error(`Failed to download Vertex video: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

export const vertexAIService = new VertexAIService();
