import { requireServerKey } from "@/lib/env";
import type { ScenePlanResult, WalkthroughMotionType } from "@/types/cinematic-walkthrough";

const PLANNER_PROMPT = `You are a real estate walkthrough planner. Analyze property images and return JSON only.
For each image, detect room type, suggest title, description, caption, motion, order, objects, annotation points, quality notes.
Think like a sales walkthrough: exterior → entrance → living → kitchen/dining → balcony → bedrooms → bathrooms → amenities.
Return strict JSON array with objects:
{
  "image_id": "uuid",
  "room_type": "exterior|entrance|living_room|kitchen|dining|bedroom|bathroom|balcony|amenity|other",
  "title": "Modern Kitchen",
  "description": "Brief scene description",
  "caption": "Sales caption for buyer",
  "suggested_motion": "push_in|pull_out|truck_left|truck_right|pedestal_up|pedestal_down|cinematic_zoom|static_premium|depth_parallax|slow_rotate",
  "suggested_order": 1,
  "important_objects": ["island", "countertop"],
  "suggested_annotations": [{"title": "Kitchen island", "x": 0.5, "y": 0.6}],
  "quality_notes": "Image quality assessment",
  "include": true,
  "warnings": ["optional warning strings"]
}`;

export class WalkthroughPlannerService {
  private get apiKey() {
    return requireServerKey("OPENROUTER_API_KEY", "OpenRouter");
  }

  private get model() {
    return process.env.OPENROUTER_PLANNER_MODEL ?? process.env.OPENROUTER_PRIMARY_MODEL ?? "google/gemini-2.5-flash-preview";
  }

  async planScenes(
    images: { id: string; url: string; file_name: string }[],
  ): Promise<{ plans: ScenePlanResult[]; flow_warnings: string[] }> {
    const content: { type: string; text?: string; image_url?: { url: string } }[] = [
      {
        type: "text",
        text: `${PLANNER_PROMPT}\n\nImages to analyze:\n${images.map((img, i) => `${i + 1}. id=${img.id} file=${img.file_name}`).join("\n")}`,
      },
    ];

    for (const img of images.slice(0, 20)) {
      content.push({ type: "image_url", image_url: { url: img.url } });
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "RealSite Walkthrough Planner",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content }],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`Planner error: ${res.status} ${await res.text()}`);

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

    const plans: ScenePlanResult[] = (parsed.scenes ?? parsed.plans ?? (Array.isArray(parsed) ? parsed : [])).map(
      (p: Record<string, unknown>, idx: number) => ({
        image_id: String(p.image_id ?? images[idx]?.id ?? ""),
        room_type: String(p.room_type ?? "other"),
        title: String(p.title ?? `Scene ${idx + 1}`),
        description: String(p.description ?? ""),
        caption: String(p.caption ?? ""),
        suggested_motion: (p.suggested_motion as WalkthroughMotionType) ?? "push_in",
        suggested_order: Number(p.suggested_order ?? idx + 1),
        important_objects: Array.isArray(p.important_objects) ? p.important_objects.map(String) : [],
        suggested_annotations: Array.isArray(p.suggested_annotations)
          ? p.suggested_annotations.map((a: { title?: string; x?: number; y?: number }) => ({
              title: String(a.title ?? "Feature"),
              x: Math.min(1, Math.max(0, Number(a.x ?? 0.5))),
              y: Math.min(1, Math.max(0, Number(a.y ?? 0.5))),
            }))
          : [],
        quality_notes: String(p.quality_notes ?? ""),
        include: p.include !== false,
        warnings: Array.isArray(p.warnings) ? p.warnings.map(String) : [],
      }),
    );

    const flow_warnings: string[] = Array.isArray(parsed.flow_warnings) ? parsed.flow_warnings.map(String) : [];
    const roomTypes = plans.filter((p) => p.include).map((p) => p.room_type);
    if (!roomTypes.includes("exterior")) flow_warnings.push("This property has no exterior scene.");
    if (!roomTypes.some((r) => r.includes("bedroom"))) flow_warnings.push("This property has no bedroom scene.");

    return { plans, flow_warnings };
  }

  async extractRagFromChat(
    userMessage: string,
    conversationHistory: { role: string; content: string }[],
  ): Promise<{ reply: string; entries: { category: string; title: string; content: string }[] }> {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "RealSite RAG Extractor",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You help real estate teams build approved property knowledge for an AI assistant.
Extract structured facts from user messages into RAG entries. Categories: project_details, unit_details, pricing, availability, amenities, possession, legal, rera, faq, developer_profile, nri_process.
Return JSON: {"reply": "friendly confirmation", "entries": [{"category": "pricing", "title": "Starting price", "content": "..."}]}
Only extract facts explicitly stated. Do not invent data.`,
          },
          ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`RAG extract error: ${res.status} ${await res.text()}`);

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));

    return {
      reply: String(parsed.reply ?? "I've saved the property details you shared."),
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map((e: { category?: string; title?: string; content?: string }) => ({
            category: String(e.category ?? "project_details"),
            title: String(e.title ?? "Property detail"),
            content: String(e.content ?? ""),
          }))
        : [],
    };
  }
}

export const walkthroughPlannerService = new WalkthroughPlannerService();
