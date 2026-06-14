import { GEMINI_35_FLASH_MODEL, sendChatCompletion } from "@/lib/openrouter";
import { parseWalkthroughPlan, type WalkthroughPlanPayload } from "@/lib/walkthrough-planner-schema";
import type { ScenePlanResult, WalkthroughMotionType } from "@/types/cinematic-walkthrough";

const PROPERTY_FLOWS: Record<string, string> = {
  residential: "exterior → entrance → living → dining → kitchen → balcony → bedrooms → bathrooms → amenities → CTA",
  villa: "exterior → gate → entrance → living → dining → kitchen → master bedroom → pool → garden → terrace → CTA",
  office: "building exterior → reception → lift lobby → floor plate → open workspace → cabins → conference rooms → pantry → parking → leasing CTA",
  coworking: "reception → lounge → hot desk → private cabin → meeting room → phone booth → event space → cafe → pricing CTA",
  warehouse: "gate → loading bay → storage → production floor → admin office → parking → compliance zones → CTA",
  factory: "gate → loading bay → production floor → storage → admin office → parking → fire safety → CTA",
  interior: "entrance → living → dining → kitchen → bedroom → bathroom → detail shots → materials → CTA",
};

function buildPlannerPrompt(propertyType: string, propertyName?: string) {
  const flow = PROPERTY_FLOWS[propertyType] ?? PROPERTY_FLOWS.residential;
  return `You are a Property Walkthrough planner for real estate. Analyze property images and return strict JSON only.
Property: ${propertyName ?? "Unnamed property"}
Property type: ${propertyType}
Recommended flow: ${flow}

For each image: classify room_type, title, description, sales caption, motion, order, duration (4-8 sec), conservative Veo video prompt, objects, annotation pins (normalized x/y 0-1), quality notes.
Veo prompts must preserve exact architecture, furniture, layout. No people. No fake furniture. No distortion.
Return JSON object:
{
  "tour_title": "Premium Villa Walkthrough",
  "property_type": "${propertyType}",
  "flow_warnings": ["optional warnings"],
  "scenes": [{
    "image_id": "uuid",
    "room_type": "exterior|entrance|living_room|kitchen|...",
    "title": "Modern Kitchen",
    "description": "Brief scene description",
    "caption": "Sales caption",
    "suggested_motion": "push_in",
    "suggested_order": 1,
    "duration": 6,
    "veo_prompt": "Create a premium real-estate walkthrough motion from this kitchen image. Slow forward dolly with subtle parallax. Preserve exact room layout, architecture, furniture, walls, flooring, windows, lighting, and proportions. Do not add people. Do not change architecture. Do not distort objects.",
    "important_objects": ["island"],
    "suggested_annotations": [{"title": "Kitchen island", "x": 0.5, "y": 0.6, "category": "feature"}],
    "quality_notes": "Assessment",
    "include": true,
    "warnings": []
  }]
}`;
}

function toScenePlanResults(plan: WalkthroughPlanPayload): ScenePlanResult[] {
  return plan.scenes.map((p) => ({
    image_id: p.image_id,
    room_type: p.room_type,
    title: p.title,
    description: p.description,
    caption: p.caption,
    suggested_motion: p.suggested_motion as WalkthroughMotionType,
    suggested_order: p.suggested_order,
    duration: p.duration,
    veo_prompt: p.veo_prompt,
    important_objects: p.important_objects,
    suggested_annotations: p.suggested_annotations.map((a) => ({
      title: a.title,
      x: a.x,
      y: a.y,
      category: a.category,
    })),
    quality_notes: p.quality_notes,
    include: p.include,
    warnings: p.warnings,
  }));
}

export class WalkthroughPlannerService {
  private get model() {
    return process.env.OPENROUTER_PLANNER_MODEL ?? process.env.OPENROUTER_PRIMARY_MODEL ?? GEMINI_35_FLASH_MODEL;
  }

  async planScenes(
    images: { id: string; url: string; file_name: string }[],
    options?: { propertyType?: string; propertyName?: string },
  ): Promise<{ plan: WalkthroughPlanPayload; plans: ScenePlanResult[]; flow_warnings: string[] }> {
    const propertyType = options?.propertyType ?? "residential";
    const content = [
      {
        type: "text" as const,
        text: `${buildPlannerPrompt(propertyType, options?.propertyName)}\n\nImages:\n${images.map((img, i) => `${i + 1}. id=${img.id} file=${img.file_name}`).join("\n")}`,
      },
      ...images.slice(0, 35).map((img) => ({
        type: "image_url" as const,
        imageUrl: { url: img.url },
      })),
    ];

    const result = await sendChatCompletion({
      model: this.model,
      messages: [{ role: "user", content }],
      temperature: 0.2,
      maxTokens: 12000,
      responseFormat: { type: "json_object" },
      reasoning: { effort: "minimal" },
    });

    const raw = result.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    } catch {
      const repair = await sendChatCompletion({
        model: this.model,
        messages: [
          { role: "system", content: "Fix the JSON and return only valid JSON matching the walkthrough plan schema." },
          { role: "user", content: String(raw) },
        ],
        temperature: 0,
        maxTokens: 12000,
        responseFormat: { type: "json_object" },
        reasoning: { effort: "minimal" },
      });
      parsed = JSON.parse(String(repair.choices?.[0]?.message?.content ?? "{}"));
    }

    const plan = parseWalkthroughPlan(parsed, images.map((img) => img.id), propertyType);
    const plans = toScenePlanResults(plan);
    return { plan, plans, flow_warnings: plan.flow_warnings };
  }

  async extractRagFromChat(
    userMessage: string,
    conversationHistory: { role: string; content: string }[],
  ): Promise<{ reply: string; entries: { category: string; title: string; content: string }[] }> {
    const result = await sendChatCompletion({
      model: this.model,
      messages: [
        {
          role: "system",
          content: `You help real estate teams build approved property knowledge for an AI assistant.
Extract structured facts from user messages into RAG entries. Categories: project_details, unit_details, pricing, availability, amenities, possession, legal, rera, faq, developer_profile, nri_process, leasing, warehouse_specs, factory_specs, seat_capacity.
Return JSON: {"reply": "friendly confirmation", "entries": [{"category": "pricing", "title": "Starting price", "content": "..."}]}
Only extract facts explicitly stated. Do not invent data.`,
        },
        ...conversationHistory.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      maxTokens: 4096,
      responseFormat: { type: "json_object" },
    });

    const raw = result.choices?.[0]?.message?.content ?? "{}";
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

  async suggestAnnotationFromText(
    userText: string,
    sceneTitle: string,
  ): Promise<{ title: string; short_description: string; description: string; category: string; ai_context: string }> {
    const result = await sendChatCompletion({
      model: this.model,
      messages: [
        {
          role: "system",
          content: `Convert natural language pin descriptions into structured annotation JSON for scene "${sceneTitle}".
Return JSON: {"title":"","short_description":"","description":"","category":"feature|material|amenity|view|leasing|compliance|cta","ai_context":""}`,
        },
        { role: "user", content: userText },
      ],
      temperature: 0.15,
      maxTokens: 1024,
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(String(result.choices?.[0]?.message?.content ?? "{}"));
    return {
      title: String(parsed.title ?? "Feature"),
      short_description: String(parsed.short_description ?? parsed.title ?? ""),
      description: String(parsed.description ?? ""),
      category: String(parsed.category ?? "feature"),
      ai_context: String(parsed.ai_context ?? userText),
    };
  }
}

export const walkthroughPlannerService = new WalkthroughPlannerService();
