import { NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashIp, parseClientDevice } from "@/lib/brochure/device-parser";
import { hashViewerPhone, normalizePhone } from "@/lib/brochure/viewer-identity";
import { brochureIntentService } from "@/services/brochure-intent.service";
import { crmService } from "@/services/crm.service";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  brochureId: z.string().uuid(),
  propertyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  consentGiven: z.boolean(),
  viewerName: z.string().min(2).max(120),
  viewerPhone: z.string().min(8).max(20),
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

    const phone = normalizePhone(body.viewerPhone);
    const phoneHash = hashViewerPhone(phone);
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
      .or(`ip_hash.eq.${ipHash},viewer_phone_hash.eq.${phoneHash}`)
      .order("started_at", { ascending: false })
      .limit(1);

    const isReopen = Boolean(priorSessions?.length);
    const daysSinceLast = priorSessions?.[0]?.started_at
      ? Math.floor((Date.now() - new Date(priorSessions[0].started_at).getTime()) / 86400000)
      : 0;

    const lead = await crmService.findOrCreateLeadByPhone({
      organizationId: body.organizationId,
      propertyId: body.propertyId,
      sessionId,
      name: body.viewerName.trim(),
      phone,
      campaign: body.utmCampaign,
    });

    const { data: existingProfile } = await admin
      .from("brochure_viewer_profiles")
      .select("id, total_sessions")
      .eq("organization_id", body.organizationId)
      .eq("viewer_phone_hash", phoneHash)
      .maybeSingle();

    let viewerProfileId = existingProfile?.id;
    if (existingProfile) {
      await admin.from("brochure_viewer_profiles").update({
        viewer_name: body.viewerName.trim(),
        viewer_phone: phone,
        lead_id: lead.id,
        last_seen_at: new Date().toISOString(),
        total_sessions: (existingProfile.total_sessions ?? 1) + 1,
      }).eq("id", existingProfile.id);
    } else {
      const { data: createdProfile } = await admin.from("brochure_viewer_profiles").insert({
        organization_id: body.organizationId,
        viewer_name: body.viewerName.trim(),
        viewer_phone: phone,
        viewer_phone_hash: phoneHash,
        lead_id: lead.id,
      }).select("id").single();
      viewerProfileId = createdProfile?.id;
    }

    await admin.from("buyer_sessions").insert({
      id: sessionId,
      organization_id: body.organizationId,
      property_id: body.propertyId,
      brochure_id: body.brochureId,
      lead_id: lead.id,
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      screen_width: body.screenWidth,
      screen_height: body.screenHeight,
      consent_given: true,
      ip_hash: ipHash,
      viewer_name: body.viewerName.trim(),
      viewer_phone: phone,
      viewer_phone_hash: phoneHash,
      utm_source: body.utmSource,
      utm_medium: body.utmMedium,
      utm_campaign: body.utmCampaign,
      metadata: {
        ...(body.referrerSessionId ? { shared_from_session: body.referrerSessionId } : {}),
        ...(isReopen ? { reopen: true, days_since_last: daysSinceLast } : { first_visit: true }),
        viewer_profile_id: viewerProfileId,
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
        viewerName: body.viewerName.trim(),
        viewerPhone: phone,
        daysSinceLast: isReopen ? daysSinceLast : undefined,
      },
    });

    await brochureIntentService.refreshSessionIntent(sessionId, body.brochureId, body.propertyId, body.organizationId);

    return NextResponse.json({
      sessionId,
      leadId: lead.id,
      isReopen,
      daysSinceLast,
      viewerProfileId: viewerProfileId,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Session failed", 500);
  }
}
