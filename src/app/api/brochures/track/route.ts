import { NextResponse } from "next/server";
import { z } from "zod";
import { brochureIntentService } from "@/services/brochure-intent.service";
import { jsonError } from "@/lib/api-utils";

const schema = z.object({
  sessionId: z.string().uuid(),
  brochureId: z.string().uuid(),
  propertyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  eventType: z.string(),
  pageNumber: z.coerce.number().optional(),
  payload: z.record(z.unknown()).optional(),
  pageView: z.object({
    viewId: z.string().uuid().optional(),
    pageNumber: z.coerce.number(),
    pageCategory: z.string().optional(),
    dwellSeconds: z.coerce.number(),
    scrollDepthMax: z.coerce.number().optional(),
    zoomLevelMax: z.coerce.number().optional(),
    visibleSections: z.array(z.unknown()).optional(),
  }).optional(),
  heatmap: z.object({
    pageNumber: z.coerce.number(),
    x: z.coerce.number().min(0).max(1),
    y: z.coerce.number().min(0).max(1),
    eventType: z.string().optional(),
    dwellSeconds: z.coerce.number().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    if (body.pageView) {
      const viewId = await brochureIntentService.recordPageView({
        sessionId: body.sessionId,
        brochureId: body.brochureId,
        propertyId: body.propertyId,
        organizationId: body.organizationId,
        pageNumber: body.pageView.pageNumber,
        pageCategory: body.pageView.pageCategory,
        dwellSeconds: body.pageView.dwellSeconds,
        scrollDepthMax: body.pageView.scrollDepthMax,
        zoomLevelMax: body.pageView.zoomLevelMax,
        visibleSections: body.pageView.visibleSections,
        viewId: body.pageView.viewId,
      });
      await brochureIntentService.refreshSessionIntent(body.sessionId, body.brochureId, body.propertyId, body.organizationId);
      return NextResponse.json({ ok: true, viewId });
    }

    if (body.heatmap) {
      await brochureIntentService.recordHeatmapPoint({
        sessionId: body.sessionId,
        brochureId: body.brochureId,
        propertyId: body.propertyId,
        organizationId: body.organizationId,
        pageNumber: body.heatmap.pageNumber,
        x: body.heatmap.x,
        y: body.heatmap.y,
        eventType: body.heatmap.eventType,
        dwellSeconds: body.heatmap.dwellSeconds,
      });
      return NextResponse.json({ ok: true });
    }

    await brochureIntentService.recordViewerEvent({
      sessionId: body.sessionId,
      brochureId: body.brochureId,
      propertyId: body.propertyId,
      organizationId: body.organizationId,
      eventType: body.eventType,
      pageNumber: body.pageNumber,
      payload: body.payload,
    });

    if (["brochure_page_viewed", "brochure_downloaded", "brochure_reopened", "brochure_tab_hidden"].includes(body.eventType)) {
      await brochureIntentService.refreshSessionIntent(body.sessionId, body.brochureId, body.propertyId, body.organizationId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Track failed", 500);
  }
}
