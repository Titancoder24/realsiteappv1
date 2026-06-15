"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { BrochurePage, PropertyBrochure } from "@/types/brochure-intelligence";
import { loadPdfDocument, renderPdfPage } from "@/lib/brochure/pdf-client";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Share2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

function pageMeta(pages: BrochurePage[] = [], pageNumber: number) {
  return pages.find((p) => p.page_number === pageNumber);
}

export function BrochureViewer({
  brochure,
  sessionId,
}: {
  brochure: PropertyBrochure & {
    properties?: { name: string; projects?: { name: string; branding?: { primary_color?: string } } };
  };
  sessionId: string;
}) {
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(brochure.page_count);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageEnteredAt = useRef(Date.now());
  const activeViewId = useRef<string | undefined>(undefined);
  const lastActivity = useRef(Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const maxScrollDepth = useRef(0);

  const pdfUrl = `/api/brochures/public/${brochure.slug}/file`;

  function trackedShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("ref_session", sessionId);
    return url.toString();
  }

  const track = useCallback(
    async (body: Record<string, unknown>) => {
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
    },
    [sessionId, brochure.id, brochure.property_id, brochure.organization_id],
  );

  const flushPageView = useCallback(
    async (nextPage?: number) => {
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
            scrollDepthMax: maxScrollDepth.current,
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
        maxScrollDepth.current = 0;
        setPage(nextPage);
      }
    },
    [page, zoom, sessionId, brochure, track],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadPdfDocument(pdfUrl)
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("We couldn't open this brochure. Try downloading the PDF instead.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);

    renderPdfPage(pdfDoc, page, canvasRef.current, zoom)
      .catch(() => {
        if (!cancelled) setError("Failed to render this page.");
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, page, zoom]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        flushPageView();
        track({ eventType: "brochure_tab_hidden", pageNumber: page });
      }
    };
    const onActivity = () => {
      lastActivity.current = Date.now();
    };
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
    const clamped = Math.min(totalPages, Math.max(1, next));
    if (clamped === page) return;
    flushPageView(clamped);
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    track({ heatmap: { pageNumber: page, x, y, eventType: "tap" } });
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const delta = end - start;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goTo(page + 1);
    else goTo(page - 1);
  }

  async function shareLink() {
    const url = trackedShareUrl();
    if (navigator.share) {
      await navigator.share({ title: brochure.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    }
    await track({ eventType: "brochure_shared", pageNumber: page, payload: { method: "native_share", ref_session: sessionId } });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(trackedShareUrl());
    toast.success("Tracked link copied — forwards are attributed");
    await track({ eventType: "brochure_shared", pageNumber: page, payload: { method: "copy_link", ref_session: sessionId } });
  }

  async function downloadPdf() {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${brochure.slug}.pdf`;
    a.rel = "noopener";
    a.click();
    await track({ eventType: "brochure_downloaded", pageNumber: page });
  }

  const current = pageMeta(brochure.brochure_pages, page);
  const brand = brochure.properties?.projects?.branding?.primary_color;

  return (
    <div className="flex h-[100dvh] flex-col bg-zinc-950 text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-white/60">{brochure.properties?.projects?.name ?? "Project"}</p>
          <h1
            className="truncate text-sm font-semibold"
            style={brand ? { color: brand } : undefined}
          >
            {brochure.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-white/15 p-2 hover:bg-white/5"
            onClick={copyLink}
            aria-label="Copy share link"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md border border-white/15 p-2 hover:bg-white/5"
            onClick={downloadPdf}
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md border border-white/15 p-2 hover:bg-white/5"
            onClick={shareLink}
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="relative flex-1 overflow-auto bg-zinc-900"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onScroll={(e) => {
          lastActivity.current = Date.now();
          const el = e.currentTarget;
          const depth = el.scrollHeight <= el.clientHeight
            ? 1
            : (el.scrollTop + el.clientHeight) / el.scrollHeight;
          maxScrollDepth.current = Math.max(maxScrollDepth.current, Math.min(1, depth));
        }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Opening brochure…</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="max-w-sm text-sm text-white/80">{error}</p>
            <button
              type="button"
              onClick={downloadPdf}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Download PDF
            </button>
          </div>
        )}

        {!error && (
          <div className="flex min-h-full items-start justify-center p-4">
            <div className="relative shadow-2xl">
              <canvas
                ref={canvasRef}
                onClick={onCanvasClick}
                className="max-w-none rounded-sm bg-white"
                aria-label={`${brochure.title}, page ${page}`}
              />
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-xs text-white/70">
          <span>{current?.title ?? `Page ${page}`}</span>
          <span>
            {page} / {totalPages}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-md border border-white/15 px-3 py-2 disabled:opacity-40"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md border border-white/15 p-2"
            onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.2).toFixed(1))))}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0.6}
            max={2.4}
            step={0.1}
            value={zoom}
            onChange={(e) => {
              const next = Number(e.target.value);
              setZoom(next);
              track({ heatmap: { pageNumber: page, x: 0.5, y: 0.5, eventType: "zoom_focus" } });
            }}
            className="flex-1"
            aria-label="Zoom"
          />
          <button
            type="button"
            className="rounded-md border border-white/15 p-2"
            onClick={() => setZoom((z) => Math.min(2.4, Number((z + 0.2).toFixed(1))))}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md border border-white/15 px-3 py-2 disabled:opacity-40"
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
