"use client";

import { Badge } from "@/components/ui/badge";

interface SessionRow {
  id: string;
  brochure_id?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  screen_width?: number | null;
  screen_height?: number | null;
  started_at?: string;
  utm_source?: string | null;
  metadata?: { reopen?: boolean; days_since_last?: number; shared_from_session?: string };
}

interface PageViewRow {
  session_id: string;
  page_number: number;
  page_category?: string | null;
  dwell_seconds: number;
}

interface IntentRow {
  session_id: string;
  intent_band: string;
  intent_score: number;
}

export function BrochureBuyerSessions({
  sessions,
  pageViews,
  intents,
  brochures,
}: {
  sessions: SessionRow[];
  pageViews: PageViewRow[];
  intents: IntentRow[];
  brochures: { id: string; title: string }[];
}) {
  const brochureMap = new Map(brochures.map((b) => [b.id, b.title]));
  const intentMap = new Map(intents.map((i) => [i.session_id, i]));

  const viewsBySession = new Map<string, PageViewRow[]>();
  for (const v of pageViews) {
    const list = viewsBySession.get(v.session_id) ?? [];
    list.push(v);
    viewsBySession.set(v.session_id, list);
  }

  if (!sessions.length) {
    return <p className="text-sm text-muted-foreground">No buyer sessions yet. Share a tracked brochure link to start.</p>;
  }

  return (
    <div className="space-y-3">
      {sessions.slice(0, 20).map((s) => {
        const intent = intentMap.get(s.id);
        const views = (viewsBySession.get(s.id) ?? []).sort((a, b) => b.dwell_seconds - a.dwell_seconds).slice(0, 3);
        const reopen = s.metadata?.reopen;
        return (
          <div key={s.id} className="rounded-lg border p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{brochureMap.get(s.brochure_id ?? "") ?? "Brochure"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.device ?? "device"} · {s.browser ?? "browser"} · {s.os ?? "os"}
                  {s.screen_width ? ` · ${s.screen_width}×${s.screen_height}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {reopen && <Badge variant="outline">Re-opened{s.metadata?.days_since_last ? ` · ${s.metadata.days_since_last}d later` : ""}</Badge>}
                {s.metadata?.shared_from_session && <Badge variant="outline">Shared open</Badge>}
                {intent && (
                  <Badge variant={intent.intent_band === "hot" ? "default" : "secondary"}>
                    {intent.intent_band} · {intent.intent_score}
                  </Badge>
                )}
              </div>
            </div>
            {views.length > 0 && (
              <div className="space-y-1 text-xs text-muted-foreground">
                {views.map((v) => (
                  <p key={`${s.id}-${v.page_number}`}>
                    {(v.page_category ?? `page ${v.page_number}`).replace(/_/g, " ")} — {Math.floor(v.dwell_seconds / 60)}m {v.dwell_seconds % 60}s
                  </p>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">{s.started_at ? new Date(s.started_at).toLocaleString() : ""}</p>
          </div>
        );
      })}
    </div>
  );
}

export function BrochureHeatmapPanel({
  points,
  pageNumber = 1,
}: {
  points: { page_number: number; x: number; y: number }[];
  pageNumber?: number;
}) {
  const filtered = points.filter((p) => p.page_number === pageNumber);
  if (!filtered.length) {
    return <p className="text-sm text-muted-foreground">Heatmap data appears after buyers tap/zoom on brochure pages.</p>;
  }

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-xs rounded-md border bg-white">
      {filtered.map((p, i) => (
        <span
          key={i}
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/70"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        />
      ))}
      <p className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">Page {pageNumber}</p>
    </div>
  );
}
