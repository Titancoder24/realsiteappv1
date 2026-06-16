"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfDocument, renderPdfPage } from "@/lib/brochure/pdf-client";

type HeatPoint = { page_number: number; x: number; y: number; event_type?: string };

const EVENT_WEIGHTS: Record<string, number> = {
  tap: 1,
  click: 1,
  zoom_in: 0.7,
  zoom_out: 0.5,
  zoom_focus: 0.8,
};

function drawHeatSignature(
  canvas: HTMLCanvasElement,
  points: HeatPoint[],
  width: number,
  height: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = width;
  canvas.height = height;

  const heat = document.createElement("canvas");
  heat.width = width;
  heat.height = height;
  const hctx = heat.getContext("2d");
  if (!hctx) return;

  const radius = Math.max(18, Math.min(width, height) * 0.08);

  for (const p of points) {
    const px = p.x * width;
    const py = p.y * height;
    const weight = EVENT_WEIGHTS[p.event_type ?? "tap"] ?? 0.6;
    const grad = hctx.createRadialGradient(px, py, 0, px, py, radius);
    grad.addColorStop(0, `rgba(255, 40, 0, ${0.55 * weight})`);
    grad.addColorStop(0.4, `rgba(255, 120, 0, ${0.25 * weight})`);
    grad.addColorStop(1, "rgba(255, 200, 0, 0)");
    hctx.fillStyle = grad;
    hctx.beginPath();
    hctx.arc(px, py, radius, 0, Math.PI * 2);
    hctx.fill();
  }

  const imageData = hctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 8) continue;
    const t = Math.min(1, alpha / 180);
    if (t < 0.25) {
      data[i] = 0;
      data[i + 1] = Math.floor(80 + t * 400);
      data[i + 2] = 255;
    } else if (t < 0.55) {
      data[i] = Math.floor((t - 0.25) * 600);
      data[i + 1] = 255;
      data[i + 2] = Math.floor(255 - (t - 0.25) * 400);
    } else {
      data[i] = 255;
      data[i + 1] = Math.floor(255 - (t - 0.55) * 500);
      data[i + 2] = 0;
    }
    data[i + 3] = Math.min(220, alpha + 40);
  }
  hctx.putImageData(imageData, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(heat, 0, 0);

  for (const p of points) {
    const px = p.x * width;
    const py = p.y * height;
    const isZoom = p.event_type?.startsWith("zoom");
    ctx.beginPath();
    ctx.arc(px, py, isZoom ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isZoom ? "rgba(59, 130, 246, 0.9)" : "rgba(220, 38, 38, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function BrochureHeatSignature({
  pdfUrl,
  pageNumber,
  points,
  className,
}: {
  pdfUrl?: string;
  pageNumber: number;
  points: HeatPoint[];
  className?: string;
}) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [dims, setDims] = useState({ width: 320, height: 420 });
  const [loading, setLoading] = useState(Boolean(pdfUrl));

  useEffect(() => {
    if (!pdfUrl) return;
    let cancelled = false;
    setLoading(true);
    loadPdfDocument(pdfUrl)
      .then((doc) => { if (!cancelled) setPdfDoc(doc); })
      .catch(() => { if (!cancelled) setPdfDoc(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const pdfCanvas = pdfCanvasRef.current;
      const heatCanvas = heatCanvasRef.current;
      const container = containerRef.current;
      if (!heatCanvas || !container) return;

      const maxW = Math.min(container.clientWidth || 400, 480);
      let w = maxW;
      let h = Math.round(maxW * 1.33);

      if (pdfDoc && pdfCanvas) {
        const scale = maxW / 400;
        const rendered = await renderPdfPage(pdfDoc, pageNumber, pdfCanvas, scale);
        if (cancelled) return;
        w = rendered.width;
        h = rendered.height;
      }

      setDims({ width: w, height: h });
      drawHeatSignature(heatCanvas, points, w, h);
    }

    render();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNumber, points, pdfUrl]);

  return (
    <div ref={containerRef} className={className}>
      <div className="relative mx-auto inline-block rounded-md border bg-white shadow-inner" style={{ width: dims.width, height: dims.height }}>
        {pdfUrl && (
          <canvas
            ref={pdfCanvasRef}
            className="absolute inset-0 h-full w-full"
            style={{ opacity: loading ? 0.3 : 1 }}
          />
        )}
        <canvas
          ref={heatCanvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ mixBlendMode: pdfUrl ? "multiply" : "normal", opacity: pdfUrl ? 0.85 : 1 }}
        />
        {!pdfUrl && !points.length && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-50 text-xs text-muted-foreground">
            No interaction data for this page
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-sm bg-gradient-to-r from-blue-400 via-yellow-400 to-red-500" /> Heat signature</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Tap / click</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Zoom</span>
        <span>{points.length} interaction{points.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}
