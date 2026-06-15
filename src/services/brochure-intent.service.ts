import { createAdminClient } from "@/lib/supabase/admin";
import { crmService } from "./crm.service";
import type { BrochureIntentSummary } from "@/types/brochure-intelligence";

const CATEGORY_WEIGHTS: Record<string, number> = {
  pricing: 18,
  floor_plan: 16,
  payment_plan: 15,
  amenities: 10,
  location: 8,
  contact: 12,
  specifications: 8,
  gallery: 5,
  legal: 4,
  overview: 4,
  general: 2,
};

export class BrochureIntentService {
  async recordPageView(params: {
    sessionId: string;
    brochureId: string;
    propertyId: string;
    organizationId: string;
    pageNumber: number;
    pageCategory?: string;
    dwellSeconds: number;
    scrollDepthMax?: number;
    zoomLevelMax?: number;
    visibleSections?: unknown[];
    viewId?: string;
  }) {
    const admin = createAdminClient();

    if (params.viewId) {
      await admin.from("brochure_page_views").update({
        exited_at: new Date().toISOString(),
        dwell_seconds: params.dwellSeconds,
        scroll_depth_max: params.scrollDepthMax ?? 0,
        zoom_level_max: params.zoomLevelMax ?? 1,
        visible_sections: params.visibleSections ?? [],
      }).eq("id", params.viewId);
      return params.viewId;
    }

    const { data } = await admin.from("brochure_page_views").insert({
      session_id: params.sessionId,
      brochure_id: params.brochureId,
      property_id: params.propertyId,
      organization_id: params.organizationId,
      page_number: params.pageNumber,
      page_category: params.pageCategory,
      dwell_seconds: params.dwellSeconds,
      scroll_depth_max: params.scrollDepthMax ?? 0,
      zoom_level_max: params.zoomLevelMax ?? 1,
      visible_sections: params.visibleSections ?? [],
    }).select("id").single();

    await crmService.recordEvent({
      sessionId: params.sessionId,
      propertyId: params.propertyId,
      organizationId: params.organizationId,
      eventType: "brochure_page_viewed",
      payload: {
        brochureId: params.brochureId,
        pageNumber: params.pageNumber,
        pageCategory: params.pageCategory,
        dwellSeconds: params.dwellSeconds,
      },
    });

    return data?.id;
  }

  async recordHeatmapPoint(params: {
    sessionId: string;
    brochureId: string;
    propertyId: string;
    organizationId: string;
    pageNumber: number;
    x: number;
    y: number;
    eventType?: string;
    dwellSeconds?: number;
  }) {
    const admin = createAdminClient();
    await admin.from("brochure_heatmap_points").insert({
      session_id: params.sessionId,
      brochure_id: params.brochureId,
      property_id: params.propertyId,
      organization_id: params.organizationId,
      page_number: params.pageNumber,
      x: params.x,
      y: params.y,
      event_type: params.eventType ?? "tap",
      dwell_seconds: params.dwellSeconds ?? 0,
    });
  }

  async recordViewerEvent(params: {
    sessionId: string;
    brochureId: string;
    propertyId: string;
    organizationId: string;
    eventType: string;
    pageNumber?: number;
    payload?: Record<string, unknown>;
  }) {
    const admin = createAdminClient();
    await admin.from("brochure_viewer_events").insert({
      session_id: params.sessionId,
      brochure_id: params.brochureId,
      property_id: params.propertyId,
      organization_id: params.organizationId,
      event_type: params.eventType,
      page_number: params.pageNumber,
      payload: params.payload ?? {},
    });

    const crmEventMap: Record<string, string> = {
      brochure_opened: "brochure_opened",
      brochure_reopened: "brochure_reopened",
      brochure_downloaded: "brochure_downloaded",
      brochure_printed: "brochure_printed",
      brochure_shared: "brochure_shared",
      brochure_pricing_focus: "brochure_pricing_focus",
      brochure_floor_plan_focus: "brochure_floor_plan_focus",
    };

    const crmType = crmEventMap[params.eventType] ?? params.eventType;
    await crmService.recordEvent({
      sessionId: params.sessionId,
      propertyId: params.propertyId,
      organizationId: params.organizationId,
      eventType: crmType,
      payload: { brochureId: params.brochureId, pageNumber: params.pageNumber, ...params.payload },
    });

    if (["brochure_downloaded", "brochure_shared", "brochure_pricing_focus"].includes(params.eventType)) {
      await this.refreshSessionIntent(params.sessionId, params.brochureId, params.propertyId, params.organizationId);
    }
  }

  async refreshSessionIntent(sessionId: string, brochureId: string, propertyId: string, organizationId: string) {
    const admin = createAdminClient();

    const [{ data: pageViews }, { data: events }, { data: session }] = await Promise.all([
      admin.from("brochure_page_views").select("page_number, page_category, dwell_seconds").eq("session_id", sessionId).eq("brochure_id", brochureId),
      admin.from("brochure_viewer_events").select("event_type").eq("session_id", sessionId).eq("brochure_id", brochureId),
      admin.from("buyer_sessions").select("lead_id, started_at").eq("id", sessionId).single(),
    ]);

    const pageDwell = new Map<number, { category?: string; dwell: number }>();
    for (const v of pageViews ?? []) {
      const prev = pageDwell.get(v.page_number);
      pageDwell.set(v.page_number, {
        category: v.page_category ?? prev?.category,
        dwell: (prev?.dwell ?? 0) + (v.dwell_seconds ?? 0),
      });
    }

    const topPages = [...pageDwell.entries()]
      .map(([page_number, meta]) => ({ page_number, category: meta.category, dwell_seconds: meta.dwell }))
      .sort((a, b) => b.dwell_seconds - a.dwell_seconds)
      .slice(0, 5);

    let score = 15;
    for (const p of topPages) {
      score += CATEGORY_WEIGHTS[p.category ?? "general"] ?? 2;
      if (p.dwell_seconds >= 120) score += 8;
      else if (p.dwell_seconds >= 60) score += 5;
      else if (p.dwell_seconds >= 30) score += 3;
    }

    const eventTypes = new Set((events ?? []).map((e) => e.event_type));
    if (eventTypes.has("brochure_downloaded")) score += 15;
    if (eventTypes.has("brochure_shared")) score += 12;
    if (eventTypes.has("brochure_reopened")) score += 10;

    score = Math.max(0, Math.min(100, score));
    const intent_band = score >= 75 ? "hot" : score >= 45 ? "warm" : "cold";

    const topLabels = topPages.slice(0, 3).map((p) => {
      const label = p.category?.replace(/_/g, " ") ?? `page ${p.page_number}`;
      const mins = Math.floor(p.dwell_seconds / 60);
      const secs = p.dwell_seconds % 60;
      return `${label} — ${mins}m ${secs}s`;
    });

    const summary_text = topPages.length
      ? `Buyer spent most time on: ${topLabels.join("; ")}.`
      : "Buyer opened the brochure but page engagement is still limited.";

    let recommended_action = "Send a follow-up WhatsApp with project highlights.";
    if (topPages[0]?.category === "pricing" || topPages[0]?.category === "payment_plan") {
      recommended_action = "High pricing interest — share payment plan and call within 10 minutes.";
    } else if (topPages[0]?.category === "floor_plan") {
      recommended_action = "Layout-focused buyer — share 3BHK availability and floor plan variants.";
    } else if (intent_band === "hot") {
      recommended_action = "Hot intent — call today and offer a site visit slot.";
    }

    const { data: prior } = await admin
      .from("brochure_intent_summaries")
      .select("visit_count")
      .eq("session_id", sessionId)
      .eq("brochure_id", brochureId)
      .maybeSingle();

    const visit_count = (prior?.visit_count ?? 0) + (eventTypes.has("brochure_reopened") ? 1 : 0) || 1;

    const { data } = await admin.from("brochure_intent_summaries").upsert({
      session_id: sessionId,
      brochure_id: brochureId,
      property_id: propertyId,
      organization_id: organizationId,
      lead_id: session?.lead_id ?? null,
      intent_score: score,
      intent_band,
      top_pages: topPages,
      summary_text,
      recommended_action,
      visit_count: Math.max(visit_count, 1),
      updated_at: new Date().toISOString(),
    }, { onConflict: "session_id,brochure_id" }).select().single();

    if (session?.lead_id) {
      await crmService.refreshIntentScore(session.lead_id);
    }

    return data as BrochureIntentSummary;
  }

  async getOrgAnalytics(organizationId: string) {
    const admin = createAdminClient();

    const [
      { data: brochures },
      { data: sessions },
      { data: pageViews },
      { data: summaries },
      { data: heatmaps },
    ] = await Promise.all([
      admin.from("property_brochures").select("id, title, property_id, status, properties(name)").eq("organization_id", organizationId),
      admin.from("buyer_sessions").select("id, brochure_id, device, browser, os, started_at, property_id").eq("organization_id", organizationId).not("brochure_id", "is", null).order("started_at", { ascending: false }).limit(500),
      admin.from("brochure_page_views").select("page_number, page_category, dwell_seconds, brochure_id").eq("organization_id", organizationId),
      admin.from("brochure_intent_summaries").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(100),
      admin.from("brochure_heatmap_points").select("page_number, x, y, brochure_id").eq("organization_id", organizationId).limit(2000),
    ]);

    const pageStats = new Map<string, { category: string; totalDwell: number; views: number }>();
    for (const v of pageViews ?? []) {
      const key = v.page_category ?? `page_${v.page_number}`;
      const prev = pageStats.get(key) ?? { category: key, totalDwell: 0, views: 0 };
      pageStats.set(key, {
        category: key,
        totalDwell: prev.totalDwell + (v.dwell_seconds ?? 0),
        views: prev.views + 1,
      });
    }

    const topPages = [...pageStats.values()].sort((a, b) => b.totalDwell - a.totalDwell).slice(0, 8);
    const hotBuyers = (summaries ?? []).filter((s) => s.intent_band === "hot").length;

    return {
      brochureCount: brochures?.length ?? 0,
      trackedSessions: sessions?.length ?? 0,
      hotBuyers,
      topPages,
      recentSessions: sessions ?? [],
      intentSummaries: summaries ?? [],
      heatmapPoints: heatmaps ?? [],
      brochures: brochures ?? [],
    };
  }
}

export const brochureIntentService = new BrochureIntentService();
