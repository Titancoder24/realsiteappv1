import { createAdminClient } from "@/lib/supabase/admin";
import type { ExperienceType, SpatialGenerationInput, SpatialGenerationResult } from "@/types/domain";
import { worldLabsService } from "./world-labs.service";

export interface SpatialEngine {
  type: ExperienceType;
  generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult>;
}

class Tour360Engine implements SpatialEngine {
  type: ExperienceType = "360_realistic";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();
    await supabase
      .from("experiences")
      .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);
    return { engine: this.type, status: "ready_for_review" };
  }
}

class WorldLabsEngine implements SpatialEngine {
  type: ExperienceType = "worldlabs_splat";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from("worldlabs_jobs")
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        experience_id: input.experienceId,
        status: "worldlabs_generation_requested",
        model: input.model ?? "default",
        input_media_asset_ids: input.mediaAssetIds,
        world_prompt_payload: { prompt: input.prompt },
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase
      .from("experiences")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);

    return {
      engine: this.type,
      status: "processing",
      jobId: job.id,
    };
  }
}

class FutureInHouseEngine implements SpatialEngine {
  type: ExperienceType = "future_inhouse_splat";

  async generate(): Promise<SpatialGenerationResult> {
    throw new Error("In-house splat engine not yet available");
  }
}

class MobileCaptureEngine implements SpatialEngine {
  type: ExperienceType = "mobile_360_capture";

  async generate(input: SpatialGenerationInput): Promise<SpatialGenerationResult> {
    const supabase = createAdminClient();
    await supabase
      .from("experiences")
      .update({ status: "draft", updated_at: new Date().toISOString() })
      .eq("id", input.experienceId);
    return { engine: this.type, status: "draft" };
  }
}

export class SpatialGenerationService {
  private engines: Record<ExperienceType, SpatialEngine> = {
    "360_realistic": new Tour360Engine(),
    worldlabs_splat: new WorldLabsEngine(),
    future_inhouse_splat: new FutureInHouseEngine(),
    mobile_360_capture: new MobileCaptureEngine(),
  };

  getEngine(type: ExperienceType): SpatialEngine {
    return this.engines[type];
  }

  async generate(type: ExperienceType, input: SpatialGenerationInput) {
    return this.getEngine(type).generate(input);
  }

  async processWorldLabsJob(jobId: string) {
    const supabase = createAdminClient();
    const { data: job } = await supabase.from("worldlabs_jobs").select("*").eq("id", jobId).single();
    if (!job) throw new Error("Job not found");

    const updateStatus = async (status: string, extra?: Record<string, unknown>) => {
      await supabase.from("worldlabs_jobs").update({ status, ...extra, updated_at: new Date().toISOString() }).eq("id", jobId);
    };

    try {
      await updateStatus("worldlabs_processing", { started_at: new Date().toISOString() });

      const mediaIds = (job.input_media_asset_ids as string[]) ?? [];
      const worldLabsIds = await resolveWorldLabsMediaIds(mediaIds);
      const prompt = (job.world_prompt_payload as { prompt?: string })?.prompt;

      if (mediaIds.length && !worldLabsIds.length) {
        throw new Error("No World Labs media_asset_id found. Re-upload images for 3D generation.");
      }

      const { operationId, operation } = await worldLabsService.generateWorld({
        mediaAssetIds: worldLabsIds.length ? worldLabsIds : undefined,
        prompt,
        model: job.model ?? undefined,
      });

      await updateStatus("worldlabs_processing", { operation_id: operationId });

      const completed = operation.done
        ? operation
        : await worldLabsService.pollUntilDone(operationId);

      if (completed.error) {
        await updateStatus("worldlabs_generation_failed", {
          error_message: completed.error.message,
          failed_at: new Date().toISOString(),
        });
        return;
      }

      const world = completed.response!;
      const assets = worldLabsService.extractSplatUrls(world);

      await updateStatus("worldlabs_succeeded", {
        world_id: assets.worldId,
        raw_world_response: world,
        raw_operation_response: completed,
      });

      await supabase.from("splat_worlds").upsert({
        property_id: job.property_id,
        experience_id: job.experience_id,
        worldlabs_job_id: jobId,
        world_id: assets.worldId,
        world_marble_url: assets.worldMarbleUrl,
        thumbnail_url: assets.thumbnailUrl,
        caption: assets.caption,
        spz_100k_url: assets.spz100kUrl,
        spz_500k_url: assets.spz500kUrl,
        spz_full_res_url: assets.spzFullResUrl,
        collider_mesh_url: assets.colliderMeshUrl,
        pano_url: assets.panoUrl,
        model: job.model,
      });

      await updateStatus("ready_for_review", { completed_at: new Date().toISOString() });
      await supabase
        .from("experiences")
        .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
        .eq("id", job.experience_id);
    } catch (err) {
      await updateStatus("worldlabs_generation_failed", {
        error_message: err instanceof Error ? err.message : "Unknown error",
        failed_at: new Date().toISOString(),
        retry_count: (job.retry_count ?? 0) + 1,
      });
      await supabase
        .from("experiences")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", job.experience_id);
    }
  }
}

async function resolveWorldLabsMediaIds(supabaseAssetIds: string[]): Promise<string[]> {
  if (!supabaseAssetIds.length) return [];
  const supabase = createAdminClient();
  const { data: assets } = await supabase
    .from("media_assets")
    .select("worldlabs_media_asset_id")
    .in("id", supabaseAssetIds);
  return (assets ?? [])
    .map((a) => a.worldlabs_media_asset_id)
    .filter((id): id is string => Boolean(id));
}

export const spatialGenerationService = new SpatialGenerationService();
