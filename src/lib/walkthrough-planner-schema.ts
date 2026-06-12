import { z } from "zod";

export const walkthroughMotionSchema = z.enum([
  "push_in", "pull_out", "truck_left", "truck_right", "pedestal_up", "pedestal_down",
  "slow_rotate", "cinematic_zoom", "static_premium", "depth_parallax",
]);

export const scenePlanItemSchema = z.object({
  image_id: z.string(),
  room_type: z.string(),
  title: z.string(),
  description: z.string().default(""),
  caption: z.string().default(""),
  suggested_motion: walkthroughMotionSchema.default("push_in"),
  suggested_order: z.number().int().positive(),
  duration: z.number().min(4).max(8).default(6),
  veo_prompt: z.string(),
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
