import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { brochureIntentService } from "@/services/brochure-intent.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  return withAuth(async (profile) => {
    const { sessionId } = await params;
    try {
      const detail = await brochureIntentService.getSessionDetail(sessionId, profile.organization_id!);
      return NextResponse.json(detail);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Session not found", 404);
    }
  }, "sales_agent");
}
