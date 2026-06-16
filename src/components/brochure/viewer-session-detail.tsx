"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExternalLink, Phone, Target } from "lucide-react";
import { BrochureHeatSignature } from "@/components/brochure/brochure-heat-signature";

interface SessionDetail {
  session: {
    id: string;
    viewer_name?: string;
    viewer_phone?: string;
    device?: string;
    browser?: string;
    os?: string;
    started_at?: string;
    lead_id?: string;
    metadata?: { reopen?: boolean; days_since_last?: number };
  };
  brochure: { id: string; title: string; slug: string; page_count: number } | null;
  pageViews: {
    page_number: number;
    page_category?: string;
    dwell_seconds: number;
    scroll_depth_max?: number;
    zoom_level_max?: number;
  }[];
  heatmapPoints: { page_number: number; x: number; y: number; event_type?: string }[];
  events: { event_type: string; page_number?: number; created_at?: string }[];
  intentSummary: {
    intent_score: number;
    intent_band: string;
    summary_text?: string;
    recommended_action?: string;
    top_pages?: { page_number: number; category?: string; dwell_seconds: number }[];
  } | null;
  viewerHistory: { sessionId: string; startedAt?: string; brochureTitle: string; isReopen: boolean }[];
}

export function ViewerSessionDetail({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [heatmapPage, setHeatmapPage] = useState(1);

  useEffect(() => {
    if (!sessionId || !open) return;
    setLoading(true);
    fetch(`/api/brochures/sessions/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setDetail(d);
        const pages = d?.heatmapPoints?.map((p: { page_number: number }) => p.page_number) ?? d?.pageViews?.map((p: { page_number: number }) => p.page_number) ?? [1];
        setHeatmapPage(pages[0] ?? 1);
      })
      .finally(() => setLoading(false));
  }, [sessionId, open]);

  const dwellChart = useMemo(() => {
    const merged = new Map<number, { page: string; seconds: number; scroll: number; zoom: number }>();
    for (const v of detail?.pageViews ?? []) {
      const label = v.page_category?.replace(/_/g, " ") ?? `Page ${v.page_number}`;
      const prev = merged.get(v.page_number);
      merged.set(v.page_number, {
        page: label,
        seconds: (prev?.seconds ?? 0) + v.dwell_seconds,
        scroll: Math.max(prev?.scroll ?? 0, v.scroll_depth_max ?? 0),
        zoom: Math.max(prev?.zoom ?? 1, v.zoom_level_max ?? 1),
      });
    }
    return [...merged.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, v]) => v);
  }, [detail?.pageViews]);

  const pageHeatPoints = (detail?.heatmapPoints ?? []).filter((p) => p.page_number === heatmapPage);
  const heatmapPages = useMemo(() => {
    const set = new Set((detail?.heatmapPoints ?? []).map((p) => p.page_number));
    for (const v of detail?.pageViews ?? []) set.add(v.page_number);
    return [...set].sort((a, b) => a - b);
  }, [detail]);

  const pdfUrl = detail?.brochure?.slug
    ? `/api/brochures/public/${detail.brochure.slug}/file`
    : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{detail?.session.viewer_name ?? "Viewer session"}</SheetTitle>
          <SheetDescription>
            Complete engagement profile — what they viewed, where they clicked, and how to close.
          </SheetDescription>
        </SheetHeader>

        {loading && <p className="py-8 text-sm text-muted-foreground">Loading session intelligence…</p>}

        {!loading && detail && (
          <div className="mt-6 space-y-6 pb-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-mono text-sm">
                  <Phone className="h-4 w-4" /> {detail.session.viewer_phone}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {detail.session.device} · {detail.session.browser} · {detail.session.os}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detail.session.started_at ? new Date(detail.session.started_at).toLocaleString() : ""}
                  {detail.session.metadata?.reopen ? ` · Returned (${detail.session.metadata.days_since_last ?? 0}d since last)` : " · First visit"}
                </p>
              </div>
              <div className="text-right">
                <Badge variant={detail.intentSummary?.intent_band === "hot" ? "default" : "secondary"}>
                  {detail.intentSummary?.intent_band ?? "cold"} intent
                </Badge>
                <div className="mt-2 w-32">
                  <Progress value={detail.intentSummary?.intent_score ?? 0} />
                  <p className="text-center text-xs">{detail.intentSummary?.intent_score ?? 0}/100</p>
                </div>
              </div>
            </div>

            {detail.intentSummary?.recommended_action && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" /> How to close this sale
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>{detail.intentSummary.summary_text}</p>
                  <p className="font-medium text-primary">{detail.intentSummary.recommended_action}</p>
                  {detail.session.lead_id && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/leads/${detail.session.lead_id}`}>
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open in Lead Pipeline
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Page dwell time</CardTitle></CardHeader>
              <CardContent className="h-52">
                {dwellChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dwellChart}>
                      <XAxis dataKey="page" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="seconds" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Seconds" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">No page views recorded yet.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Scroll depth</CardTitle></CardHeader>
                <CardContent className="h-40">
                  {dwellChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dwellChart}>
                        <XAxis dataKey="page" tick={{ fontSize: 9 }} />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="scroll" stroke="#6366f1" strokeWidth={2} dot name="%" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Zoom level</CardTitle></CardHeader>
                <CardContent className="h-40">
                  {dwellChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dwellChart}>
                        <XAxis dataKey="page" tick={{ fontSize: 9 }} />
                        <YAxis domain={[1, "auto"]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="zoom" stroke="#f59e0b" strokeWidth={2} dot name="x" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-muted-foreground">—</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Click heat signature</CardTitle>
                <CardDescription>Exact tap and zoom locations on the brochure page</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(heatmapPages.length ? heatmapPages : [1]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setHeatmapPage(p)}
                      className={`rounded-md border px-2.5 py-1 text-xs ${heatmapPage === p ? "bg-primary text-primary-foreground" : ""}`}
                    >
                      Page {p}
                    </button>
                  ))}
                </div>
                <BrochureHeatSignature
                  pdfUrl={pdfUrl}
                  pageNumber={heatmapPage}
                  points={pageHeatPoints}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Activity timeline</CardTitle></CardHeader>
              <CardContent className="max-h-48 space-y-2 overflow-y-auto">
                {(detail.events ?? []).map((e, i) => (
                  <div key={i} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                    <span className="font-medium">{e.event_type.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">
                      {e.page_number ? `Page ${e.page_number} · ` : ""}
                      {e.created_at ? new Date(e.created_at).toLocaleTimeString() : ""}
                    </span>
                  </div>
                ))}
                {!detail.events.length && <p className="text-sm text-muted-foreground">No discrete events yet.</p>}
              </CardContent>
            </Card>

            {detail.viewerHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Previous sessions (same buyer)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {detail.viewerHistory.map((h) => (
                    <div key={h.sessionId} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <span>{h.brochureTitle}</span>
                      <span className="text-xs text-muted-foreground">
                        {h.startedAt ? new Date(h.startedAt).toLocaleDateString() : ""}
                        {h.isReopen ? " · return visit" : ""}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
