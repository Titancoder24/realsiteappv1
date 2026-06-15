import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIp, parseClientDevice } from "@/lib/brochure/device-parser";
import { brochureIntentService } from "@/services/brochure-intent.service";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  brochureId: z.string().uuid(),
  propertyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  consentGiven: z.boolean(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  screenWidth: z.coerce.number().optional(),
  screenHeight: z.coerce.number().optional(),
  referrerSessionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    if (!body.consentGiven) return jsonError("Consent required for brochure analytics", 400);

    const ua = req.headers.get("user-agent") ?? "";
    const deviceInfo = parseClientDevice(ua);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    const sessionId = uuidv4();
    const admin = createAdminClient();
    const ipHash = hashIp(ip);

    const { data: priorSessions } = await admin
      .from("buyer_sessions")
      .select("id, started_at")
      .eq("brochure_id", body.brochureId)
      .eq("ip_hash", ipHash)
      .order("started_at", { ascending: false })
      .limit(1);

    const isReopen = Boolean(priorSessions?.length);
    const daysSinceLast = priorSessions?.[0]?.started_at
      ? Math.floor((Date.now() - new Date(priorSessions[0].started_at).getTime()) / 86400000)
      : 0;

    await admin.from("buyer_sessions").insert({
      id: sessionId,
      organization_id: body.organizationId,
      property_id: body.propertyId,
      brochure_id: body.brochureId,
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      screen_width: body.screenWidth,
      screen_height: body.screenHeight,
      consent_given: true,
      ip_hash: ipHash,
      utm_source: body.utmSource,
      utm_medium: body.utmMedium,
      utm_campaign: body.utmCampaign,
      metadata: {
        ...(body.referrerSessionId ? { shared_from_session: body.referrerSessionId } : {}),
        ...(isReopen ? { reopen: true, days_since_last: daysSinceLast } : {}),
      },
    });

    const openEvent = body.referrerSessionId
      ? "brochure_shared_open"
      : isReopen
        ? "brochure_reopened"
        : "brochure_opened";

    await brochureIntentService.recordViewerEvent({
      sessionId,
      brochureId: body.brochureId,
      propertyId: body.propertyId,
      organizationId: body.organizationId,
      eventType: openEvent,
      payload: {
        device: deviceInfo,
        screen: { width: body.screenWidth, height: body.screenHeight },
        daysSinceLast: isReopen ? daysSinceLast : undefined,
      },
    });

    if (isReopen || openEvent === "brochure_shared_open") {
      await brochureIntentService.refreshSessionIntent(sessionId, body.brochureId, body.propertyId, body.organizationId);
    }

    return NextResponse.json({ sessionId, isReopen, daysSinceLast });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Session failed", 500);
  }
}
