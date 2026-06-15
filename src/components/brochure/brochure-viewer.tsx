"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrochurePage, PropertyBrochure } from "@/types/brochure-intelligence";
import { ChevronLeft, ChevronRight, Download, Share2 } from "lucide-react";

function pageMeta(pages: BrochurePage[] = [], pageNumber: number) {
  return pages.find((p) => p.page_number === pageNumber);
}

export function BrochureViewer({
  brochure,
  sessionId,
}: {
  brochure: PropertyBrochure & { properties?: { name: string; projects?: { name: string; branding?: { primary_color?: string } } } };
  sessionId: string;
}) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const pageEnteredAt = useRef(Date.now());
  const activeViewId = useRef<string | undefined>(undefined);
  const lastActivity = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  const track = useCallback(async (body: Record<string, unknown>) => {
    await fetch("/api/brochures/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        brochureId: brochure.id,
        propertyId: brochure.property_id,
        organizationId: brochure.organization_id,
        ...body,
      }),
    }).catch(() => {});
  }, [sessionId, brochure.id, brochure.property_id, brochure.organization_id]);

  const flushPageView = useCallback(async (nextPage?: number) => {
    const dwellSeconds = Math.round((Date.now() - pageEnteredAt.current) / 1000);
    const meta = pageMeta(brochure.brochure_pages, page);
    const res = await fetch("/api/brochures/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        brochureId: brochure.id,
        propertyId: brochure.property_id,
        organizationId: brochure.organization_id,
        pageView: {
          viewId: activeViewId.current,
          pageNumber: page,
          pageCategory: meta?.category,
          dwellSeconds,
          zoomLevelMax: zoom,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!activeViewId.current && data.viewId) activeViewId.current = data.viewId;

    if (meta?.category === "pricing" || meta?.category === "payment_plan") {
      await track({ eventType: "brochure_pricing_focus", pageNumber: page });
    }
    if (meta?.category === "floor_plan") {
      await track({ eventType: "brochure_floor_plan_focus", pageNumber: page });
    }

    if (nextPage != null) {
      activeViewId.current = undefined;
      pageEnteredAt.current = Date.now();
      setPage(nextPage);
    }
  }, [page, zoom, sessionId, brochure, track]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        flushPageView();
        track({ eventType: "brochure_tab_hidden", pageNumber: page });
      }
    };
    const onActivity = () => { lastActivity.current = Date.now(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });

    const heartbeat = window.setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastActivity.current > 45000) return;
      flushPageView();
      pageEnteredAt.current = Date.now();
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("scroll", onActivity);
      window.clearInterval(heartbeat);
      flushPageView();
      track({ eventType: "brochure_session_end", pageNumber: page });
    };
  }, [flushPageView, page, track]);

  function goTo(next: number) {
    const clamped = Math.min(brochure.page_count, Math.max(1, next));
    if (clamped === page) return;
    flushPageView(clamped);
  }

  function onOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    track({
      heatmap: { pageNumber: page, x, y, eventType: "tap" },
    });
  }

  async function shareLink() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: brochure.title, url });
    } else {
      await navigator.clipboard.writeText(url);
    }
    await track({ eventType: "brochure_shared", pageNumber: page, payload: { method: "native_share" } });
  }

  async function downloadPdf() {
    const a = document.createElement("a");
    a.href = brochure.file_url;
    a.download = `${brochure.slug}.pdf`;
    a.click();
    await track({ eventType: "brochure_downloaded", pageNumber: page });
  }

  const current = pageMeta(brochure.brochure_pages, page);
  const brand = brochure.properties?.projects?.branding?.primary_color;

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-white/60">{brochure.properties?.projects?.name ?? "Project"}</p>
          <h1 className="truncate text-sm font-semibold" style={brand ? { color: brand } : undefined}>{brochure.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-md border border-white/15 p-2" onClick={downloadPdf} aria-label="Download">
            <Download className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-md border border-white/15 p-2" onClick={shareLink} aria-label="Share">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <iframe
          title={`${brochure.title} page ${page}`}
          src={`${brochure.file_url}#page=${page}&zoom=${Math.round(zoom * 100)}`}
          className="h-full w-full border-0 bg-white"
        />
        <div className="absolute inset-0" onClick={onOverlayClick} aria-hidden />
      </div>

      <footer className="border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-white/70">
          <span>{current?.title ?? `Page ${page}`}</span>
          <span>{page} / {brochure.page_count}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="rounded-md border border-white/15 px-3 py-2" onClick={() => goTo(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0.8}
            max={2}
            step={0.1}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
            aria-label="Zoom"
          />
          <button type="button" className="rounded-md border border-white/15 px-3 py-2" onClick={() => goTo(page + 1)} disabled={page >= brochure.page_count}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
