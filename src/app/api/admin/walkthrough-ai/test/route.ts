import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getWalkthroughAIProvider, getVertexAIConfig } from "@/lib/platform-settings";
import { vertexAIService } from "@/services/vertex-ai.service";
import { env } from "@/lib/env";

export const maxDuration = 60;

export async function POST() {
  return withAuth(async () => {
    const provider = await getWalkthroughAIProvider();
    const vertex = await getVertexAIConfig();
    const hasVertexKey = Boolean(vertex.api_key ?? process.env.GOOGLE_VERTEX_API_KEY);
    const hasOpenRouter = Boolean(env.server.OPENROUTER_API_KEY);

    const results: {
      provider: string;
      planner: { ok: boolean; model?: string; latency_ms?: number; error?: string };
      video: { ok: boolean; model?: string; operation?: string; error?: string };
      config: {
        vertex_configured: boolean;
        project_id: string;
        location: string;
        openrouter_configured: boolean;
      };
    } = {
      provider,
      planner: { ok: false },
      video: { ok: false },
      config: {
        vertex_configured: hasVertexKey,
        project_id: vertex.project_id ?? "",
        location: vertex.location ?? "us-central1",
        openrouter_configured: hasOpenRouter,
      },
    };

    if (provider === "vertex") {
      if (!hasVertexKey) {
        return NextResponse.json({
          ...results,
          planner: { ok: false, error: "Vertex API key not configured" },
          video: { ok: false, error: "Vertex API key not configured" },
        }, { status: 400 });
      }

      const plannerStart = Date.now();
      try {
        const raw = await vertexAIService.planScenes(
          [],
          {
            propertyType: "residential",
            propertyName: "Pipeline Health Check",
            promptText: 'Return JSON only: {"tour_title":"Health Check","property_type":"residential","flow_warnings":[],"scenes":[]}',
          },
        );
        const parsed = JSON.parse(raw);
        results.planner = {
          ok: Boolean(parsed?.tour_title !== undefined || parsed?.scenes !== undefined),
          model: vertex.planner_model,
          latency_ms: Date.now() - plannerStart,
        };
      } catch (err) {
        results.planner = {
          ok: false,
          model: vertex.planner_model,
          latency_ms: Date.now() - plannerStart,
          error: err instanceof Error ? err.message : "Planner test failed",
        };
      }

      try {
        const { operationName } = await vertexAIService.submitVideoJob(
          "Slow cinematic dolly forward through a modern living room. No people. Premium real estate.",
        );
        results.video = {
          ok: Boolean(operationName),
          model: vertex.video_model,
          operation: operationName,
        };
      } catch (err) {
        results.video = {
          ok: false,
          model: vertex.video_model,
          error: err instanceof Error ? err.message : "Video submit test failed",
        };
      }
    } else {
      results.planner = {
        ok: hasOpenRouter,
        error: hasOpenRouter ? undefined : "OpenRouter API key not configured in Vercel env",
      };
      results.video = {
        ok: hasOpenRouter,
        error: hasOpenRouter ? undefined : "OpenRouter API key not configured in Vercel env",
      };
    }

    const healthy = results.planner.ok && (provider === "openrouter" || results.video.ok);
    return NextResponse.json({ ok: healthy, ...results }, { status: healthy ? 200 : 502 });
  }, "platform_admin");
}
