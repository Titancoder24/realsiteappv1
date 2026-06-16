import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { brochureIntentService } from "@/services/brochure-intent.service";

export async function GET(req: NextRequest) {
  return withAuth(async (profile) => {
    const brochureId = req.nextUrl.searchParams.get("brochureId") ?? undefined;
    const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;

    if (brochureId || sessionId) {
      const heatmapPoints = await brochureIntentService.getFilteredHeatmaps(profile.organization_id!, {
        brochureId,
        sessionId,
      });
      return NextResponse.json({ heatmapPoints });
    }

    const data = await brochureIntentService.getOrgAnalytics(profile.organization_id!);
    return NextResponse.json(data);
  }, "sales_agent");
}
