import { z } from "zod";
import type { WalkthroughMotionType } from "@/types/cinematic-walkthrough";

export const walkthroughMotionSchema = z.enum([
  "push_in", "pull_out", "truck_left", "truck_right", "pedestal_up", "pedestal_down",
  "slow_rotate", "cinematic_zoom", "static_premium", "depth_parallax",
]);

const MOTION_ALIASES: Record<string, WalkthroughMotionType> = {
  dolly_in: "push_in",
  zoom_in: "push_in",
  zoom: "cinematic_zoom",
  pan_left: "truck_left",
  pan_right: "truck_right",
  pan: "truck_left",
  tilt_up: "pedestal_up",
  tilt_down: "pedestal_down",
  rotate: "slow_rotate",
  static: "static_premium",
  parallax: "depth_parallax",
  drift: "depth_parallax",
};

export function normalizeMotionType(raw: unknown): WalkthroughMotionType {
  const key = String(raw ?? "push_in").toLowerCase().replace(/[\s-]+/g, "_");
  const parsed = walkthroughMotionSchema.safeParse(key);
  if (parsed.success) return parsed.data;
  return MOTION_ALIASES[key] ?? "push_in";
}

export function defaultVeoPrompt(roomType: string, title: string): string {
  return `Create a premium real-estate walkthrough motion from this ${roomType} image (${title}). Slow forward dolly with subtle parallax. Preserve exact room layout, architecture, furniture, walls, flooring, windows, lighting, and proportions. Do not add people. Do not change architecture. Do not distort objects.`;
}

export const scenePlanItemSchema = z.object({
  image_id: z.string(),
  room_type: z.string(),
  title: z.string(),
  description: z.string().default(""),
  caption: z.string().default(""),
  suggested_motion: walkthroughMotionSchema.default("push_in"),
  suggested_order: z.number().int().positive(),
  duration: z.number().min(4).max(8).default(6),
  veo_prompt: z.string().default(""),
  important_objects: z.array(z.string()).default([]),
  suggested_annotations: z.array(z.object({
    title: z.string(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    category: z.string().optional(),
  })).default([]),
  quality_notes: z.string().default(""),
  include: z.boolean().default(true),
  warnings: z.array(z.string()).default([]),
});

export const walkthroughPlanSchema = z.object({
  tour_title: z.string().default("Property Walkthrough"),
  property_type: z.string().default("residential"),
  flow_warnings: z.array(z.string()).default([]),
  scenes: z.array(scenePlanItemSchema),
});

export type WalkthroughPlanPayload = z.infer<typeof walkthroughPlanSchema>;
export type ScenePlanItem = z.infer<typeof scenePlanItemSchema>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function normalizeSceneItem(raw: unknown, index: number, imageIds: string[]): ScenePlanItem {
  const item = asRecord(raw);
  const roomType = String(item.room_type ?? "room");
  const title = String(item.title ?? `Scene ${index + 1}`);
  const imageId = String(item.image_id ?? imageIds[index] ?? imageIds[0] ?? "");
  const veo = String(item.veo_prompt ?? "").trim() || defaultVeoPrompt(roomType, title);

  const annotations = Array.isArray(item.suggested_annotations)
    ? item.suggested_annotations.map((ann) => {
        const a = asRecord(ann);
        return {
          title: String(a.title ?? "Feature"),
          x: Math.min(1, Math.max(0, Number(a.x ?? 0.5))),
          y: Math.min(1, Math.max(0, Number(a.y ?? 0.5))),
          category: a.category ? String(a.category) : undefined,
        };
      })
    : [];

  return {
    image_id: imageId,
    room_type: roomType,
    title,
    description: String(item.description ?? ""),
    caption: String(item.caption ?? title),
    suggested_motion: normalizeMotionType(item.suggested_motion),
    suggested_order: Math.max(1, Number(item.suggested_order) || index + 1),
    duration: Math.min(8, Math.max(4, Number(item.duration) || 6)),
    veo_prompt: veo,
    important_objects: Array.isArray(item.important_objects) ? item.important_objects.map(String) : [],
    suggested_annotations: annotations,
    quality_notes: String(item.quality_notes ?? ""),
    include: item.include !== false,
    warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [],
  };
}

export function buildFallbackPlan(
  images: { id: string; file_name: string }[],
  propertyType = "residential",
): WalkthroughPlanPayload {
  return {
    tour_title: "Property Walkthrough",
    property_type: propertyType,
    flow_warnings: ["AI planner returned an incomplete plan — created one scene per uploaded image."],
    scenes: images.map((img, i) => ({
      image_id: img.id,
      room_type: "room",
      title: img.file_name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || `Scene ${i + 1}`,
      description: `Walkthrough scene ${i + 1}`,
      caption: `Scene ${i + 1}`,
      suggested_motion: "push_in",
      suggested_order: i + 1,
      duration: 6,
      veo_prompt: defaultVeoPrompt("room", img.file_name),
      important_objects: [],
      suggested_annotations: [],
      quality_notes: "",
      include: true,
      warnings: [],
    })),
  };
}

export function parseWalkthroughPlan(raw: unknown, imageIds: string[], propertyType = "residential"): WalkthroughPlanPayload {
  const root = asRecord(raw);
  const rawScenes = Array.isArray(root.scenes) ? root.scenes : [];

  let scenes = rawScenes.map((scene, index) => normalizeSceneItem(scene, index, imageIds));

  if (!scenes.length && imageIds.length) {
    return buildFallbackPlan(
      imageIds.map((id, i) => ({ id, file_name: `Scene ${i + 1}` })),
      propertyType,
    );
  }

  const usedIds = new Set<string>();
  scenes = scenes.map((scene, index) => {
    let imageId = scene.image_id;
    if (!imageIds.includes(imageId)) {
      const next = imageIds.find((id) => !usedIds.has(id)) ?? imageIds[index] ?? imageIds[0];
      imageId = next ?? imageId;
    }
    usedIds.add(imageId);
    return { ...scene, image_id: imageId };
  });

  const parsed = walkthroughPlanSchema.safeParse({
    tour_title: String(root.tour_title ?? "Property Walkthrough"),
    property_type: String(root.property_type ?? propertyType),
    flow_warnings: Array.isArray(root.flow_warnings) ? root.flow_warnings.map(String) : [],
    scenes,
  });

  if (parsed.success) return parsed.data;

  return buildFallbackPlan(
    imageIds.map((id, i) => ({ id, file_name: `Scene ${i + 1}` })),
    propertyType,
  );
}
