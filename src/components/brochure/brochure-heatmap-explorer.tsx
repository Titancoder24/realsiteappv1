"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EVENT_COLORS: Record<string, string> = {
  tap: "bg-red-500/80",
  click: "bg-red-500/80",
  zoom_in: "bg-blue-500/80",
  zoom_out: "bg-sky-400/80",
  zoom_focus: "bg-indigo-500/80",
};

export function BrochureHeatmapExplorer({
  points,
  maxPage = 20,
}: {
  points: { page_number: number; x: number; y: number; event_type?: string }[];
  maxPage?: number;
}) {
  const [page, setPage] = useState(1);
  const filtered = points.filter((p) => p.page_number === page);

  const pages = useMemo(() => {
    const set = new Set(points.map((p) => p.page_number));
    return [...set].sort((a, b) => a - b).slice(0, maxPage);
  }, [points, maxPage]);

  if (!points.length) {
    return <p className="text-sm text-muted-foreground">Heatmap appears after buyers tap, click, or zoom on brochure pages.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(pages.length ? pages : [1]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPage(p)}
            className={`rounded-md border px-3 py-1 text-xs ${page === p ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >
            Page {p}
          </button>
        ))}
      </div>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm rounded-md border bg-white shadow-inner">
        {filtered.map((p, i) => (
          <span
            key={i}
            className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${EVENT_COLORS[p.event_type ?? "tap"] ?? "bg-orange-500/80"}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            title={p.event_type ?? "tap"}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Tap / click</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Zoom in</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-400" /> Zoom out</span>
      </div>
    </div>
  );
}

export function IdentifiedViewersTable({
  viewers,
  brochures,
}: {
  viewers: {
    sessionId: string;
    name: string;
    phone: string;
    brochureId?: string | null;
    device?: string | null;
    browser?: string | null;
    startedAt?: string;
    firstVisit?: boolean;
    intentBand: string;
    intentScore: number;
    topPage?: string | null;
    topDwellSeconds: number;
    pageCount: number;
    leadId?: string | null;
  }[];
  brochures: { id: string; title: string }[];
}) {
  const brochureMap = new Map(brochures.map((b) => [b.id, b.title]));

  if (!viewers.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Every buyer must enter name and phone before viewing. Identified viewers will appear here with page-by-page engagement.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Buyer</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Brochure</th>
            <th className="px-3 py-2">First visit</th>
            <th className="px-3 py-2">Top page focus</th>
            <th className="px-3 py-2">Pages</th>
            <th className="px-3 py-2">Device</th>
            <th className="px-3 py-2">Intent</th>
          </tr>
        </thead>
        <tbody>
          {viewers.map((v) => (
            <tr key={v.sessionId} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">{v.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{v.phone}</td>
              <td className="px-3 py-2">{brochureMap.get(v.brochureId ?? "") ?? "—"}</td>
              <td className="px-3 py-2">
                {v.firstVisit ? <Badge variant="outline">First time</Badge> : <Badge variant="secondary">Returned</Badge>}
                <p className="mt-1 text-[11px] text-muted-foreground">{v.startedAt ? new Date(v.startedAt).toLocaleString() : ""}</p>
              </td>
              <td className="px-3 py-2">
                {(v.topPage ?? "—").replace(/_/g, " ")}
                {v.topDwellSeconds > 0 && (
                  <p className="text-[11px] text-muted-foreground">{Math.floor(v.topDwellSeconds / 60)}m {v.topDwellSeconds % 60}s</p>
                )}
              </td>
              <td className="px-3 py-2">{v.pageCount}</td>
              <td className="px-3 py-2 text-xs">{v.device} · {v.browser}</td>
              <td className="px-3 py-2">
                <Badge variant={v.intentBand === "hot" ? "default" : "secondary"}>{v.intentBand}</Badge>
                <p className="text-[11px]">{v.intentScore}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
