import { createAdminClient } from "@/lib/supabase/admin";
import { embeddingService } from "./embedding.service";
import { openRouterImageService } from "./openrouter-image.service";
import { openRouterVideoService } from "./openrouter-video.service";
import { walkthroughPlannerService } from "./walkthrough-planner.service";
import type { WalkthroughChecklist, WalkthroughScene } from "@/types/cinematic-walkthrough";

const MAX_IMAGES = 35;

export async function ensureWalkthroughChecklist(experienceId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("walkthrough_checklists").select("*").eq("experience_id", experienceId).maybeSingle();
  if (data) return data as WalkthroughChecklist;
  const { data: created } = await admin.from("walkthrough_checklists").insert({ experience_id: experienceId }).select().single();
  return created as WalkthroughChecklist;
}

export async function refreshWalkthroughChecklist(experienceId: string) {
  const admin = createAdminClient();
  const [{ count: imageCount }, { count: enhancedCount }, { count: sceneCount }, { count: motionCount }, { count: annCount }, { count: ragCount }] = await Promise.all([
    admin.from("walkthrough_images").select("*", { count: "exact", head: true }).eq("experience_id", experienceId),
    admin.from("walkthrough_images").select("*", { count: "exact", head: true }).eq("experience_id", experienceId).in("enhancement_status", ["approved", "completed", "skipped"]),
    admin.from("walkthrough_scenes").select("*", { count: "exact", head: true }).eq("experience_id", experienceId),
    admin.from("walkthrough_scenes").select("*", { count: "exact", head: true }).eq("experience_id", experienceId).not("video_url", "is", null),
    admin.from("walkthrough_annotations").select("*", { count: "exact", head: true }).eq("experience_id", experienceId),
    admin.from("knowledge_entries").select("*", { count: "exact", head: true }).eq("property_id", (
      await admin.from("experiences").select("property_id").eq("id", experienceId).single()
    ).data?.property_id ?? "00000000-0000-0000-0000-000000000000"),
  ]);

  const { data: exp } = await admin.from("experiences").select("status").eq("id", experienceId).single();
  const warnings: string[] = [];

  const checklist = {
    images_uploaded: (imageCount ?? 0) > 0,
    images_enhanced: (imageCount ?? 0) > 0 && (enhancedCount ?? 0) >= (imageCount ?? 0),
    scenes_created: (sceneCount ?? 0) > 0,
    scene_order_approved: (sceneCount ?? 0) > 0,
    motion_added: (sceneCount ?? 0) > 0,
    motion_videos_generated: (sceneCount ?? 0) > 0 && (motionCount ?? 0) > 0,
    annotations_added: (annCount ?? 0) > 0,
    property_rag_added: (ragCount ?? 0) >= 3,
    ai_tested: false,
    viewer_previewed: false,
    ready_to_publish:
      (imageCount ?? 0) > 0 &&
      (sceneCount ?? 0) > 0 &&
      (ragCount ?? 0) >= 1 &&
      exp?.status !== "published",
    warnings,
    updated_at: new Date().toISOString(),
  };

  await admin.from("walkthrough_checklists").upsert({ experience_id: experienceId, ...checklist });
  return checklist;
}

export async function runImageEnhancement(imageId: string) {
  const admin = createAdminClient();
  const { data: image, error } = await admin.from("walkthrough_images").select("*").eq("id", imageId).single();
  if (error || !image) throw new Error("Image not found");

  const { data: job } = await admin.from("walkthrough_enhancement_jobs").insert({
    image_id: imageId,
    status: "processing",
    model: process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-3.1-flash-image-preview",
    prompt: "Property photo enhancement",
    started_at: new Date().toISOString(),
  }).select().single();

  await admin.from("walkthrough_images").update({ enhancement_status: "processing" }).eq("id", imageId);

  try {
    const { dataUrl, model, prompt } = await openRouterImageService.enhanceImage(image.original_image_url);
    const enhancedUrl = await openRouterImageService.uploadDataUrlToStorage(
      dataUrl,
      image.organization_id,
      image.property_id,
      imageId.slice(0, 8),
    );

    await admin.from("walkthrough_images").update({
      enhanced_image_url: enhancedUrl,
      thumbnail_url: enhancedUrl,
      mobile_crop_url: enhancedUrl,
      desktop_crop_url: enhancedUrl,
      enhancement_status: "completed",
      enhancement_model: model,
      enhancement_prompt: prompt,
      enhancement_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", imageId);

    await admin.from("walkthrough_enhancement_jobs").update({
      status: "completed",
      result_url: enhancedUrl,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);

    await refreshWalkthroughChecklist(image.experience_id);
    return enhancedUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Enhancement failed";
    await admin.from("walkthrough_images").update({
      enhancement_status: "failed",
      enhancement_error: msg,
      enhanced_image_url: image.original_image_url,
      thumbnail_url: image.original_image_url,
    }).eq("id", imageId);
    await admin.from("walkthrough_enhancement_jobs").update({
      status: "failed",
      error: msg,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);
    throw err;
  }
}

export async function planAndCreateScenes(experienceId: string) {
  const admin = createAdminClient();
  const { data: images } = await admin
    .from("walkthrough_images")
    .select("*")
    .eq("experience_id", experienceId)
    .eq("included", true)
    .order("sort_order");

  if (!images?.length) throw new Error("Upload images first");

  const { data: exp } = await admin
    .from("experiences")
    .select("property_id, organization_id, properties(name, property_type)")
    .eq("id", experienceId)
    .single();
  if (!exp) throw new Error("Experience not found");

  const property = exp.properties as { name?: string; property_type?: string } | null;
  const imageInputs = images.map((img) => ({
    id: img.id,
    url: img.enhanced_image_url ?? img.original_image_url,
    file_name: img.file_name,
  }));

  const { plan, plans, flow_warnings } = await walkthroughPlannerService.planScenes(imageInputs, {
    propertyType: property?.property_type ?? "residential",
    propertyName: property?.name,
  });

  await admin.from("walkthrough_plans").upsert({
    experience_id: experienceId,
    property_id: exp.property_id,
    organization_id: exp.organization_id,
    tour_title: plan.tour_title,
    property_type: plan.property_type,
    flow_warnings: plan.flow_warnings,
    plan_json: plan,
    model: process.env.OPENROUTER_PLANNER_MODEL ?? "google/gemini-3.5-flash",
    updated_at: new Date().toISOString(),
  }, { onConflict: "experience_id" });

  await admin.from("walkthrough_scenes").delete().eq("experience_id", experienceId);

  const sorted = [...plans].sort((a, b) => a.suggested_order - b.suggested_order);
  const scenes: WalkthroughScene[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const plan = sorted[i];
    const img = images.find((im) => im.id === plan.image_id);
    if (!img || !plan.include) continue;

    const imageUrl = img.enhanced_image_url ?? img.original_image_url;

    const { data: scene } = await admin.from("walkthrough_scenes").insert({
      experience_id: experienceId,
      property_id: exp.property_id,
      organization_id: exp.organization_id,
      image_id: img.id,
      title: plan.title,
      description: plan.description,
      room_type: plan.room_type,
      caption: plan.caption,
      image_url: imageUrl,
      thumbnail_url: img.thumbnail_url ?? imageUrl,
      poster_url: img.thumbnail_url ?? imageUrl,
      scene_order: i,
      is_start_scene: i === 0,
      motion_type: plan.suggested_motion,
      veo_prompt: plan.veo_prompt,
      ai_context: `${plan.description}. ${plan.caption}`,
      quality_notes: plan.quality_notes,
      warnings: plan.warnings,
      duration: plan.duration ?? 6,
      timeline_start: i * (plan.duration ?? 6),
      timeline_end: (i + 1) * (plan.duration ?? 6),
      scene_status: "planned",
    }).select().single();

    if (scene) {
      scenes.push(scene as WalkthroughScene);
      await admin.from("walkthrough_images").update({
        ai_analysis: plan,
        room_type: plan.room_type,
        ai_caption: plan.caption,
        ai_description: plan.description,
      }).eq("id", img.id);

      for (const ann of plan.suggested_annotations.slice(0, 8)) {
        await admin.from("walkthrough_annotations").insert({
          scene_id: scene.id,
          property_id: exp.property_id,
          experience_id: experienceId,
          title: ann.title,
          short_description: ann.title,
          category: ann.category ?? "feature",
          x_position: ann.x,
          y_position: ann.y,
          rag_enabled: true,
        });
      }

      await syncWalkthroughSceneToRAG(scene as WalkthroughScene, img.organization_id);
    }
  }

  const { data: checklist } = await admin.from("walkthrough_checklists").upsert({
    experience_id: experienceId,
    scenes_created: scenes.length > 0,
    scene_order_approved: scenes.length > 0,
    motion_added: scenes.length > 0,
    warnings: flow_warnings,
    updated_at: new Date().toISOString(),
  }, { onConflict: "experience_id" }).select().single();

  await refreshWalkthroughChecklist(experienceId);
  return { scenes, flow_warnings, checklist };
}

export async function syncWalkthroughSceneToRAG(
  scene: { id: string; property_id: string; title: string; description?: string | null; ai_context?: string | null; caption?: string | null },
  organizationId: string,
) {
  const admin = createAdminClient();
  const content = scene.ai_context || scene.description || scene.caption || `Scene: ${scene.title}`;

  const { data: existing } = await admin
    .from("knowledge_entries")
    .select("id")
    .eq("source_id", scene.id)
    .eq("source_type", "walkthrough_scene")
    .maybeSingle();

  const entry = {
    organization_id: organizationId,
    property_id: scene.property_id,
    walkthrough_scene_id: scene.id,
    category: "room_context",
    title: scene.title,
    content,
    source_type: "walkthrough_scene",
    source_id: scene.id,
    approved: true,
  };

  let entryId: string;
  if (existing) {
    const { data } = await admin.from("knowledge_entries").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id").single();
    entryId = data!.id;
  } else {
    const { data } = await admin.from("knowledge_entries").insert(entry).select("id").single();
    entryId = data!.id;
  }

  const embedding = await embeddingService.embed(content);
  await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: entryId, embedding }, { onConflict: "knowledge_entry_id" });
}

export async function syncWalkthroughAnnotationToRAG(
  ann: { id: string; property_id: string; scene_id: string; title: string; description?: string | null; short_description?: string | null; ai_context?: string | null },
  organizationId: string,
  sceneTitle: string,
) {
  const admin = createAdminClient();
  const content = [`Scene: ${sceneTitle}`, `Object: ${ann.title}`, ann.short_description, ann.description, ann.ai_context].filter(Boolean).join(". ");

  const { data: existing } = await admin
    .from("knowledge_entries")
    .select("id")
    .eq("source_id", ann.id)
    .eq("source_type", "walkthrough_annotation")
    .maybeSingle();

  const entry = {
    organization_id: organizationId,
    property_id: ann.property_id,
    walkthrough_scene_id: ann.scene_id,
    walkthrough_annotation_id: ann.id,
    category: "room_context",
    title: ann.title,
    content,
    source_type: "walkthrough_annotation",
    source_id: ann.id,
    approved: true,
  };

  let entryId: string;
  if (existing) {
    const { data } = await admin.from("knowledge_entries").update({ ...entry, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id").single();
    entryId = data!.id;
  } else {
    const { data } = await admin.from("knowledge_entries").insert(entry).select("id").single();
    entryId = data!.id;
  }

  const embedding = await embeddingService.embed(content);
  await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: entryId, embedding }, { onConflict: "knowledge_entry_id" });
  await admin.from("walkthrough_annotations").update({ rag_entry_id: entryId }).eq("id", ann.id);
  return entryId;
}

export async function saveRagEntriesFromChat(
  propertyId: string,
  organizationId: string,
  entries: { category: string; title: string; content: string }[],
  createdBy?: string,
) {
  const admin = createAdminClient();
  const saved = [];

  for (const e of entries) {
    if (!e.content?.trim()) continue;
    const { data } = await admin.from("knowledge_entries").insert({
      property_id: propertyId,
      organization_id: organizationId,
      category: e.category,
      title: e.title,
      content: e.content,
      approved: true,
      created_by: createdBy,
      source_type: "walkthrough_chat",
    }).select().single();

    if (data) {
      const embedding = await embeddingService.embed(`${e.title}\n${e.content}`);
      await admin.from("knowledge_embeddings").upsert({ knowledge_entry_id: data.id, embedding }, { onConflict: "knowledge_entry_id" });
      saved.push(data);
    }
  }
  return saved;
}

export async function runSceneVideoGeneration(sceneId: string) {
  const admin = createAdminClient();
  const { data: scene, error } = await admin
    .from("walkthrough_scenes")
    .select("*, experiences(organization_id)")
    .eq("id", sceneId)
    .single();
  if (error || !scene) throw new Error("Scene not found");

  const prompt = scene.veo_prompt ?? `Create a premium real-estate walkthrough motion from this ${scene.room_type ?? "room"} image. Slow forward dolly with subtle parallax. Preserve exact layout and architecture. No people.`;
  const orgId = scene.organization_id ?? (scene.experiences as { organization_id?: string })?.organization_id;

  const { data: job } = await admin.from("walkthrough_video_jobs").insert({
    scene_id: sceneId,
    experience_id: scene.experience_id,
    property_id: scene.property_id,
    organization_id: orgId,
    status: "submitted",
    model: process.env.OPENROUTER_VIDEO_MODEL ?? "google/veo-3.1-lite",
    prompt,
    started_at: new Date().toISOString(),
  }).select().single();

  await admin.from("walkthrough_scenes").update({ scene_status: "motion_processing" }).eq("id", sceneId);

  try {
    const { jobId, pollingUrl } = await openRouterVideoService.submitVideoJob(prompt, scene.image_url);
    await admin.from("walkthrough_video_jobs").update({
      openrouter_job_id: jobId,
      polling_url: pollingUrl,
      status: "processing",
    }).eq("id", job!.id);

    const result = await openRouterVideoService.pollUntilComplete(pollingUrl);
    if (result.status === "failed" || !result.unsignedUrls.length) {
      throw new Error(result.error ?? "No video URL returned");
    }

    const storedUrl = await openRouterVideoService.downloadAndStore(
      result.unsignedUrls[0],
      orgId!,
      scene.property_id,
      sceneId,
    );

    await admin.from("walkthrough_video_jobs").update({
      status: "completed",
      unsigned_url: result.unsignedUrls[0],
      stored_video_url: storedUrl,
      video_url_720p: storedUrl,
      video_url_1080p: storedUrl,
      video_url_mobile: storedUrl,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);

    await admin.from("walkthrough_scenes").update({
      video_url: storedUrl,
      video_url_720p: storedUrl,
      video_url_1080p: storedUrl,
      video_url_mobile: storedUrl,
      scene_status: "motion_ready",
    }).eq("id", sceneId);

    await refreshWalkthroughChecklist(scene.experience_id);
    return storedUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Video generation failed";
    await admin.from("walkthrough_video_jobs").update({
      status: "failed",
      error: msg,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);
    await admin.from("walkthrough_scenes").update({ scene_status: "fallback_image" }).eq("id", sceneId);
    throw err;
  }
}

export async function generateAllSceneVideos(experienceId: string) {
  const admin = createAdminClient();
  const { data: scenes } = await admin
    .from("walkthrough_scenes")
    .select("id")
    .eq("experience_id", experienceId)
    .is("video_url", null)
    .order("scene_order");

  const results: { sceneId: string; ok: boolean; error?: string }[] = [];
  for (const scene of scenes ?? []) {
    try {
      await runSceneVideoGeneration(scene.id);
      results.push({ sceneId: scene.id, ok: true });
    } catch (e) {
      results.push({ sceneId: scene.id, ok: false, error: e instanceof Error ? e.message : "failed" });
    }
  }
  await refreshWalkthroughChecklist(experienceId);
  return results;
}

export { MAX_IMAGES };
