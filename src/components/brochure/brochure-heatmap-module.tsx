"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { BrochureHeatSignature } from "@/components/brochure/brochure-heat-signature";

type HeatPoint = { page_number: number; x: number; y: number; event_type?: string; session_id?: string };

interface ViewerOption {
  sessionId: string;
  name: string;
  phone: string;
}

export function BrochureHeatmapModule() {
  const [brochures, setBrochures] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [viewers, setViewers] = useState<ViewerOption[]>([]);
  const [brochureId, setBrochureId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [points, setPoints] = useState<HeatPoint[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/brochures/analytics")
      .then((r) => r.json())
      .then((d) => {
        setBrochures(d.brochures ?? []);
        setViewers((d.identifiedViewers ?? []).map((v: ViewerOption & { sessionId: string }) => ({
          sessionId: v.sessionId,
          name: v.name,
          phone: v.phone,
        })));
        if (d.brochures?.[0]?.id) setBrochureId(d.brochures[0].id);
      })
      .catch(() => toast.error("Failed to load heatmap data"));
  }, []);

  const loadHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brochureId) params.set("brochureId", brochureId);
      if (sessionId) params.set("sessionId", sessionId);
      const res = await fetch(`/api/brochures/analytics?${params}`);
      const data = await res.json();
      const heatPoints: HeatPoint[] = data.heatmapPoints ?? [];
      setPoints(heatPoints);
      const pages = [...new Set(heatPoints.map((p) => p.page_number))].sort((a, b) => a - b);
      setPage(pages[0] ?? 1);
    } catch {
      toast.error("Failed to load heatmap");
    } finally {
      setLoading(false);
    }
  }, [brochureId, sessionId]);

  useEffect(() => {
    if (brochureId || sessionId) loadHeatmap();
  }, [brochureId, sessionId, loadHeatmap]);

  const selectedBrochure = brochures.find((b) => b.id === brochureId);
  const pdfUrl = selectedBrochure ? `/api/brochures/public/${selectedBrochure.slug}/file` : undefined;

  const pagePoints = points.filter((p) => p.page_number === page);
  const pages = useMemo(() => {
    const set = new Set(points.map((p) => p.page_number));
    return [...set].sort((a, b) => a - b);
  }, [points]);

  const eventBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of points) {
      const key = p.event_type ?? "tap";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({
      type: type.replace(/_/g, " "),
      count,
    }));
  }, [points]);

  const pageBreakdown = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of points) {
      counts.set(p.page_number, (counts.get(p.page_number) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([pageNum, count]) => ({ page: `Page ${pageNum}`, count }));
  }, [points]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Heatmap filters</CardTitle>
          <CardDescription>View org-wide, per-brochure, or per-identified-viewer click signatures</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Brochure</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={brochureId}
              onChange={(e) => { setBrochureId(e.target.value); setSessionId(""); }}
            >
              <option value="">All brochures</option>
              {brochures.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Identified viewer</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">All viewers{brochureId ? " (this brochure)" : ""}</option>
              {viewers.map((v) => (
                <option key={v.sessionId} value={v.sessionId}>{v.name} · {v.phone}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Interactions by page</CardTitle></CardHeader>
          <CardContent className="h-48">
            {pageBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pageBreakdown}>
                  <XAxis dataKey="page" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No interactions yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Interaction types</CardTitle></CardHeader>
          <CardContent className="h-48">
            {eventBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventBreakdown}>
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Tap, click, and zoom data appears here.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Click heat signature</CardTitle>
          <CardDescription>
            Picture-perfect overlay on the actual brochure page — red/yellow hot zones show where buyers tapped and zoomed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading heatmap…</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {(pages.length ? pages : [1]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`rounded-md border px-3 py-1 text-xs ${page === p ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    Page {p} ({points.filter((pt) => pt.page_number === p).length})
                  </button>
                ))}
              </div>
              <BrochureHeatSignature
                pdfUrl={pdfUrl}
                pageNumber={page}
                points={pagePoints}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
