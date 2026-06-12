import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { generateAllSceneVideos, runSceneVideoGeneration } from "@/services/walkthrough.service";

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = await req.json();
    const { experience_id, scene_id } = body as { experience_id?: string; scene_id?: string };

    if (scene_id) {
      const url = await runSceneVideoGeneration(scene_id);
      return NextResponse.json({ ok: true, scene_id, video_url: url });
    }

    if (!experience_id) {
      return NextResponse.json({ error: "experience_id or scene_id required" }, { status: 400 });
    }

    const results = await generateAllSceneVideos(experience_id);
    const completed = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, completed, total: results.length, results });
  });
}
