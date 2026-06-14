import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { runSceneVideoGeneration, queueAllSceneVideoJobs, queueSceneVideoJob } from "@/services/walkthrough.service";

export const maxDuration = 10;

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = await req.json();
    const { experience_id, scene_id, wait, force } = body as {
      experience_id?: string;
      scene_id?: string;
      wait?: boolean;
      force?: boolean;
    };

    if (scene_id) {
      if (wait) {
        const url = await runSceneVideoGeneration(scene_id);
        return NextResponse.json({ ok: true, scene_id, video_url: url });
      }
      const queued = await queueSceneVideoJob(scene_id, { force });
      return NextResponse.json({ ok: true, ...queued });
    }

    if (!experience_id) {
      return NextResponse.json({ error: "experience_id or scene_id required" }, { status: 400 });
    }

    const results = await queueAllSceneVideoJobs(experience_id);
    const queued = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: true,
      queued,
      submitted: queued,
      total: results.length,
      results,
      message: "Jobs queued — Veo runs in background via poll",
    });
  }, "project_manager");
}
