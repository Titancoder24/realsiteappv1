import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-utils";
import {
  getWalkthroughAIProvider,
  getVertexAIConfig,
  setPlatformSetting,
  clearPlatformSettingsCache,
  type WalkthroughAIProvider,
} from "@/lib/platform-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function GET() {
  return withAuth(async () => {
    const provider = await getWalkthroughAIProvider();
    const vertex = await getVertexAIConfig();
    const hasVertexKey = Boolean(vertex.api_key ?? process.env.GOOGLE_VERTEX_API_KEY);
    const hasOpenRouter = Boolean(env.server.OPENROUTER_API_KEY);

    return NextResponse.json({
      provider,
      openrouter: {
        configured: hasOpenRouter,
        planner: env.server.OPENROUTER_PLANNER_MODEL,
        video: env.server.OPENROUTER_VIDEO_MODEL,
      },
      vertex: {
        configured: hasVertexKey,
        planner_model: vertex.planner_model ?? "gemini-3.5-flash",
        video_model: vertex.video_model ?? "veo-3.1-lite-generate-001",
        location: vertex.location ?? "us-central1",
        project_id: vertex.project_id ?? "",
        api_key_set: hasVertexKey,
        api_key_preview: vertex.api_key ? `${vertex.api_key.slice(0, 6)}…` : (process.env.GOOGLE_VERTEX_API_KEY ? "env" : ""),
      },
    });
  }, "platform_admin");
}

const patchSchema = z.object({
  provider: z.enum(["openrouter", "vertex"]).optional(),
  vertex_api_key: z.string().optional(),
  vertex_project_id: z.string().optional(),
  vertex_location: z.string().optional(),
  vertex_planner_model: z.string().optional(),
  vertex_video_model: z.string().optional(),
  reason: z.string().optional(),
});

export async function PATCH(req: Request) {
  return withAuth(async (profile) => {
    const body = patchSchema.parse(await req.json());
    const existing = await getVertexAIConfig();

    if (body.provider) {
      await setPlatformSetting("walkthrough_ai_provider", body.provider as WalkthroughAIProvider, profile.id);
    }

    const nextVertex = {
      ...existing,
      api_key: body.vertex_api_key?.trim() || existing.api_key,
      project_id: body.vertex_project_id !== undefined ? body.vertex_project_id.trim() : existing.project_id,
      location: body.vertex_location?.trim() || existing.location || "us-central1",
      planner_model: body.vertex_planner_model?.trim() || existing.planner_model || "gemini-3.5-flash",
      video_model: body.vertex_video_model?.trim() || existing.video_model || "veo-3.1-lite-generate-001",
    };

    const vertexTouched =
      body.vertex_api_key !== undefined ||
      body.vertex_project_id !== undefined ||
      body.vertex_location !== undefined ||
      body.vertex_planner_model !== undefined ||
      body.vertex_video_model !== undefined;

    if (vertexTouched || body.provider) {
      await setPlatformSetting("vertex_ai_config", nextVertex, profile.id);
    }

    const admin = createAdminClient();
    await admin.from("admin_audit_logs").insert({
      actor_id: profile.id,
      action: body.provider ? "walkthrough_ai_provider_switch" : "walkthrough_vertex_config_save",
      target_type: "platform_settings",
      target_id: body.provider ? "walkthrough_ai_provider" : "vertex_ai_config",
      reason: body.reason ?? (body.provider ? "Super admin provider toggle" : "Vertex credentials saved"),
      payload: { provider: body.provider, project_id: nextVertex.project_id, has_api_key: Boolean(nextVertex.api_key) },
    });

    const provider = body.provider ?? (await getWalkthroughAIProvider());
    clearPlatformSettingsCache();
    return NextResponse.json({ ok: true, provider, vertex: nextVertex });
  }, "platform_admin");
}
