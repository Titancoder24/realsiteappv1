import { buildFallbackPlan, parseWalkthroughPlan, type WalkthroughPlanPayload } from "@/lib/walkthrough-planner-schema";
import { getWalkthroughAIProvider } from "@/lib/platform-settings";
import { walkthroughPlannerService } from "./walkthrough-planner.service";
import { vertexAIService } from "./vertex-ai.service";
import type { ScenePlanResult } from "@/types/cinematic-walkthrough";

const PROPERTY_FLOWS: Record<string, string> = {
  residential: "exterior → entrance → living → dining → kitchen → balcony → bedrooms → bathrooms → amenities → CTA",
  villa: "exterior → gate → entrance → living → dining → kitchen → master bedroom → pool → garden → terrace → CTA",
  office: "building exterior → reception → lift lobby → floor plate → open workspace → cabins → conference rooms → pantry → parking → leasing CTA",
};

function buildPlannerPrompt(propertyType: string, propertyName?: string, images?: { id: string; file_name: string }[]) {
  const flow = PROPERTY_FLOWS[propertyType] ?? PROPERTY_FLOWS.residential;
  return `You are a Property Walkthrough planner for real estate. Analyze property images and return strict JSON only.
Property: ${propertyName ?? "Unnamed property"}
Property type: ${propertyType}
Recommended flow: ${flow}

For each image: classify room_type, title, description, sales caption, motion (push_in|pull_out|truck_left|truck_right|pedestal_up|pedestal_down|slow_rotate|cinematic_zoom|static_premium|depth_parallax), order, duration (4-8 sec), veo_prompt, objects, annotation pins (normalized x/y 0-1), quality notes.
Return JSON: {"tour_title":"","property_type":"","flow_warnings":[],"scenes":[{"image_id":"uuid","room_type":"","title":"","description":"","caption":"","suggested_motion":"push_in","suggested_order":1,"duration":6,"veo_prompt":"","important_objects":[],"suggested_annotations":[],"quality_notes":"","include":true,"warnings":[]}]}

Images:
${(images ?? []).map((img, i) => `${i + 1}. id=${img.id} file=${img.file_name}`).join("\n")}`;
}

function toScenePlanResults(plan: WalkthroughPlanPayload): ScenePlanResult[] {
  return plan.scenes.map((p) => ({
    image_id: p.image_id,
    room_type: p.room_type,
    title: p.title,
    description: p.description,
    caption: p.caption,
    suggested_motion: p.suggested_motion,
    suggested_order: p.suggested_order,
    duration: p.duration,
    veo_prompt: p.veo_prompt,
    important_objects: p.important_objects,
    suggested_annotations: p.suggested_annotations,
    quality_notes: p.quality_notes,
    include: p.include,
    warnings: p.warnings,
  }));
}

export async function planWalkthroughScenes(
  images: { id: string; url: string; file_name: string }[],
  options?: { propertyType?: string; propertyName?: string },
): Promise<{ plan: WalkthroughPlanPayload; plans: ScenePlanResult[]; flow_warnings: string[]; provider: string }> {
  const propertyType = options?.propertyType ?? "residential";
  const imageIds = images.map((img) => img.id);

  const provider = await getWalkthroughAIProvider();
  const warnings: string[] = [];

  try {
    if (provider === "vertex") {
      const promptText = buildPlannerPrompt(propertyType, options?.propertyName, images);
      const raw = await vertexAIService.planScenes(images, { ...options, promptText });
      const plan = parseWalkthroughPlan(JSON.parse(raw), imageIds, propertyType);
      return { plan, plans: toScenePlanResults(plan), flow_warnings: plan.flow_warnings, provider: "vertex" };
    }

    const result = await walkthroughPlannerService.planScenes(images, options);
    return { ...result, provider: "openrouter" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI planning failed";
    warnings.push(`AI planner unavailable (${msg}) — created scenes from your uploaded images.`);
    const plan = buildFallbackPlan(images, propertyType);
    plan.flow_warnings = [...plan.flow_warnings, ...warnings];
    return { plan, plans: toScenePlanResults(plan), flow_warnings: plan.flow_warnings, provider: "fallback" };
  }
}
