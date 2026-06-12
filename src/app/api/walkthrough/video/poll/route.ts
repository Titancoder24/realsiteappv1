import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { pollPendingVideoJobs } from "@/services/walkthrough.service";

export const maxDuration = 30;

export async function POST(req: Request) {
  return withAuth(async () => {
    const body = await req.json();
    const { experience_id } = body as { experience_id?: string };
    if (!experience_id) {
      return NextResponse.json({ error: "experience_id required" }, { status: 400 });
    }

    const results = await pollPendingVideoJobs(experience_id);
    const completed = results.filter((r) => r.status === "completed").length;
    const processing = results.filter((r) => r.status === "processing").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return NextResponse.json({ ok: true, completed, processing, failed, results });
  }, "project_manager");
}
