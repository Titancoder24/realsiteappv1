import { createAdminClient } from "@/lib/supabase/admin";
import { SPHERE_CAPTURE } from "@/lib/capture/capture-protocol";

const MIN_FRAMES = SPHERE_CAPTURE.minBuckets;

export class StitchService {
  async processRoom(
    captureRoomId: string,
    stitchedImageUrl?: string,
    panoramaConfig?: Record<string, unknown>,
  ) {
    const admin = createAdminClient();

    const { data: room } = await admin
      .from("capture_rooms")
      .select("*, capture_frames(*)")
      .eq("id", captureRoomId)
      .single();
    if (!room) throw new Error("Capture room not found");

    const frames = (room.capture_frames as { angle_label: string; image_url: string; sort_order: number }[]) ?? [];
    frames.sort((a, b) => a.sort_order - b.sort_order);

    if (frames.length < MIN_FRAMES) {
      await admin.from("capture_rooms").update({ status: "needs_retake", quality_score: "Missing" }).eq("id", captureRoomId);
      const { data: job } = await admin.from("stitch_jobs").insert({
        capture_room_id: captureRoomId,
        experience_id: room.experience_id,
        organization_id: room.organization_id,
        status: "needs_more_angles",
        frame_count: frames.length,
        error_message: `Need at least ${MIN_FRAMES} angles. We need one more angle to complete this room.`,
      }).select().single();
      return { job, scene: null, needsRetake: true };
    }

    const { data: job } = await admin.from("stitch_jobs").insert({
      capture_room_id: captureRoomId,
      experience_id: room.experience_id,
      organization_id: room.organization_id,
      status: "processing",
      frame_count: frames.length,
    }).select().single();

    await admin.from("capture_rooms").update({ status: "processing" }).eq("id", captureRoomId);

    const panoramaUrl = stitchedImageUrl ?? frames.find((f) => f.angle_label === "front")?.image_url ?? frames[0].image_url;
    const hasDoorway = frames.some((f) => f.angle_label === "doorway");
    const quality = frames.length >= 4 ? (hasDoorway ? "Excellent" : "Good") : "Needs retake";

    const { data: existingScenes } = await admin
      .from("tour_360_scenes")
      .select("id")
      .eq("experience_id", room.experience_id);

    const isFirst = !existingScenes?.length;

    let scene;
    if (room.scene_id) {
      const { data } = await admin.from("tour_360_scenes").update({
        room_name: room.room_name,
        image_url: panoramaUrl,
        thumbnail_url: frames[0].image_url,
        panorama_config: panoramaConfig ?? {},
      }).eq("id", room.scene_id).select().single();
      scene = data;
    } else {
      const { data, error } = await admin.from("tour_360_scenes").insert({
        experience_id: room.experience_id,
        property_id: room.property_id,
        room_name: room.room_name,
        image_url: panoramaUrl,
        thumbnail_url: frames[0].image_url,
        is_start_scene: isFirst,
        sort_order: room.sort_order ?? 0,
        panorama_config: panoramaConfig ?? {},
      }).select().single();
      if (error) throw error;
      scene = data;
    }

    await admin.from("capture_rooms").update({
      status: "complete",
      quality_score: quality,
      scene_id: scene.id,
      updated_at: new Date().toISOString(),
    }).eq("id", captureRoomId);

    await admin.from("stitch_jobs").update({
      status: "succeeded",
      result_scene_id: scene.id,
      stitched_image_url: panoramaUrl,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);

    await admin.from("experiences").update({
      status: "ready_for_review",
      updated_at: new Date().toISOString(),
    }).eq("id", room.experience_id);

    return { job, scene, needsRetake: false };
  }
}

export const stitchService = new StitchService();
