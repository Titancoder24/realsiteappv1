import { requireServerKey } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const ENHANCEMENT_PROMPT = `Enhance this real estate property photo for a premium listing walkthrough.
Improve lighting, exposure, noise reduction, color balance, and sharpness.
Upscale clarity while preserving exact room layout, materials, furniture, windows, and views.
Do NOT add, remove, or alter any structural elements, furniture, flooring, walls, or scenery.
Return only the enhanced image — no text overlays or watermarks.`;

export class OpenRouterImageService {
  private get apiKey() {
    return requireServerKey("OPENROUTER_API_KEY", "OpenRouter");
  }

  private get imageModel() {
    return process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-2.5-flash-image-preview";
  }

  async enhanceImage(imageUrl: string, customPrompt?: string): Promise<{ dataUrl: string; model: string; prompt: string }> {
    const prompt = customPrompt ?? ENHANCEMENT_PROMPT;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "RealSite Cinematic Walkthrough",
      },
      body: JSON.stringify({
        model: this.imageModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter image enhancement failed: ${res.status} ${await res.text()}`);
    }

    const json = await res.json();
    const message = json.choices?.[0]?.message;
    const images = message?.images ?? message?.content?.filter?.((c: { type?: string }) => c.type === "image_url");

    let dataUrl: string | undefined;
    if (Array.isArray(message?.images) && message.images[0]) {
      dataUrl = message.images[0].image_url?.url ?? message.images[0].imageUrl?.url;
    }
    if (!dataUrl && Array.isArray(images) && images[0]) {
      dataUrl = images[0].image_url?.url;
    }

    if (!dataUrl) {
      throw new Error("OpenRouter returned no enhanced image");
    }

    return { dataUrl, model: this.imageModel, prompt };
  }

  async uploadDataUrlToStorage(
    dataUrl: string,
    organizationId: string,
    propertyId: string,
    suffix: string,
  ): Promise<string> {
    const admin = createAdminClient();
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data URL");

    const mime = match[1];
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const buffer = Buffer.from(match[2], "base64");
    const path = `${organizationId}/${propertyId}/walkthrough/enhanced-${Date.now()}-${suffix}.${ext}`;

    const { error } = await admin.storage.from("media").upload(path, buffer, { contentType: mime, upsert: false });
    if (error) throw error;

    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);
    return publicUrl;
  }
}

export const openRouterImageService = new OpenRouterImageService();
