import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { brochureIntentService } from "@/services/brochure-intent.service";

export async function GET() {
  return withAuth(async (profile) => {
    const data = await brochureIntentService.getOrgAnalytics(profile.organization_id!);
    return NextResponse.json(data);
  }, "sales_agent");
}
