"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ExternalLink, Upload, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { getPdfPageCount } from "@/lib/brochure/pdf-client";
import { isPdfFile, pdfContentType } from "@/lib/brochure/pdf-utils";
import { BrochureBuyerSessions, BrochureHeatmapPanel } from "@/components/brochure/brochure-buyer-sessions";

interface Analytics {
  brochureCount: number;
  trackedSessions: number;
  hotBuyers: number;
  topPages: { category: string; totalDwell: number; views: number }[];
  intentSummaries: {
    id: string;
    session_id: string;
    intent_score: number;
    intent_band: string;
    summary_text?: string;
    recommended_action?: string;
    top_pages?: { page_number: number; category?: string; dwell_seconds: number }[];
  }[];
  recentSessions: {
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
  }[];
  sessionPageViews: { session_id: string; page_number: number; page_category?: string | null; dwell_seconds: number }[];
  heatmapPoints: { page_number: number; x: number; y: number; brochure_id?: string }[];
  salesAlerts: { id: string; alert_type: string; message: string; recommended_action?: string; intent_band: string; created_at?: string }[];
  brochures: { id: string; title: string; slug: string; status: string; properties?: { name: string } }[];
}

export function BrochureIntelligenceDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [uploading, setUploading] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [pageCount, setPageCount] = useState("8");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  const load = () => {
    fetch("/api/brochures/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load brochure analytics"));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { id: string; name: string }[]) => setProperties(rows))
      .catch(() => {});
  }, []);

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPdfFile(file)) {
      toast.error("Please choose a PDF file");
      e.target.value = "";
      return;
    }

    const resolvedTitle = title || file.name.replace(/\.pdf$/i, "");
    if (!propertyId || !resolvedTitle) {
      toast.error("Select a property and add a title before uploading");
      e.target.value = "";
      return;
    }

    if (!title) setTitle(resolvedTitle);

    let count = Number(pageCount);
    try {
      count = await getPdfPageCount(file);
      setPageCount(String(count));
    } catch {
      toast.message("Page count could not be auto-detected — using your entered value");
    }

    setUploading(true);
    try {
      const prepRes = await fetch("/api/brochures/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          propertyId,
          contentType: pdfContentType(file),
        }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok) throw new Error(prep.error ?? "Could not prepare upload");

      let uploaded = false;
      if (prep.signedUrl) {
        const uploadRes = await fetch(prep.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": prep.contentType },
          body: file,
        });
        uploaded = uploadRes.ok;
      }

      if (!uploaded) {
        if (file.size <= 4 * 1024 * 1024) {
          const form = new FormData();
          form.append("file", file);
          form.append("propertyId", propertyId);
          form.append("title", resolvedTitle);
          form.append("pageCount", String(Number.isFinite(count) && count > 0 ? count : Number(pageCount) || 1));
          form.append("publish", "true");
          const fallbackRes = await fetch("/api/brochures", { method: "POST", body: form });
          const fallbackJson = await fallbackRes.json();
          if (!fallbackRes.ok) throw new Error(fallbackJson.error ?? "Storage upload failed");
          toast.success("Brochure published — copy the tracked link below");
          setTitle("");
          load();
          return;
        }
        throw new Error("Direct storage upload failed. Try a smaller PDF or contact support.");
      }

      const createRes = await fetch("/api/brochures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          title: resolvedTitle,
          fileUrl: prep.publicUrl,
          fileName: file.name,
          fileSize: file.size,
          pageCount: Number.isFinite(count) && count > 0 ? count : Number(pageCount) || 1,
          publish: true,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Could not save brochure");

      toast.success("Brochure published — copy the tracked link below");
      setTitle("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    await onFileSelect(e);
  }

  function shareUrl(slug: string) {
    if (typeof window === "undefined") return `/brochure/${slug}`;
    return `${window.location.origin}/brochure/${slug}`;
  }

  async function copyShareLink(slug: string) {
    await navigator.clipboard.writeText(shareUrl(slug));
    toast.success("Tracked share link copied");
  }

  const chartData = (data?.topPages ?? []).map((p) => ({
    name: p.category.replace(/_/g, " "),
    seconds: p.totalDwell,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Buyer Intent Analytics for Property Brochures</h1>
        <p className="text-sm text-muted-foreground">Know which buyer is serious before your competitor calls them — page views, heatmaps, device intel, AI summaries, and sales alerts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Brochures", value: data?.brochureCount ?? 0 },
          { label: "Tracked opens", value: data?.trackedSessions ?? 0 },
          { label: "Hot buyers", value: data?.hotBuyers ?? 0 },
          { label: "Top page focus", value: data?.topPages?.[0]?.category?.replace(/_/g, " ") ?? "—" },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardDescription>{k.label}</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold capitalize">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most engaging brochure sections</CardTitle></CardHeader>
          <CardContent className="h-64">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="seconds" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No brochure engagement yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Upload tracked brochure</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {properties.length === 0 && (
              <p className="text-xs text-muted-foreground">No properties found. Create a property first, then upload.</p>
            )}
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">Select property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Input placeholder="Brochure title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Page count (auto-detected when possible)" value={pageCount} onChange={(e) => setPageCount(e.target.value)} />
            <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted ${uploading ? "opacity-60" : ""}`}>
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading PDF…" : "Choose PDF brochure"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={onUpload}
                disabled={uploading}
              />
            </label>
            <p className="text-xs text-muted-foreground">PDFs upload directly to storage (up to 50MB). Pick a property and title first.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sales alerts</CardTitle><CardDescription>Hot buyers, re-opens, and shared opens</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {(data?.salesAlerts ?? []).slice(0, 8).map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge>{a.alert_type.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline">{a.intent_band}</Badge>
                </div>
                <p className="text-sm">{a.message}</p>
                {a.recommended_action && <p className="mt-1 text-xs text-muted-foreground">→ {a.recommended_action}</p>}
              </div>
            ))}
            {!data?.salesAlerts?.length && <p className="text-sm text-muted-foreground">Alerts appear when a buyer becomes hot or re-opens a brochure.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Page heatmap (aggregated taps)</CardTitle></CardHeader>
          <CardContent>
            <BrochureHeatmapPanel points={data?.heatmapPoints ?? []} pageNumber={1} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Buyer sessions</CardTitle><CardDescription>Per-client page focus, device info, and intent</CardDescription></CardHeader>
        <CardContent>
          <BrochureBuyerSessions
            sessions={data?.recentSessions ?? []}
            pageViews={data?.sessionPageViews ?? []}
            intents={(data?.intentSummaries ?? []).map((s) => ({ session_id: s.session_id, intent_band: s.intent_band, intent_score: s.intent_score }))}
            brochures={(data?.brochures ?? []).map((b) => ({ id: b.id, title: b.title }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>AI buyer intent summaries</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {(data?.intentSummaries ?? []).map((s) => (
            <div key={s.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant={s.intent_band === "hot" ? "default" : "secondary"}>{s.intent_band} intent</Badge>
                <div className="w-28"><Progress value={s.intent_score} /><p className="mt-1 text-center text-xs">{s.intent_score}</p></div>
              </div>
              <p className="text-sm">{s.summary_text}</p>
              {s.recommended_action && <p className="mt-2 text-xs text-muted-foreground">→ {s.recommended_action}</p>}
            </div>
          ))}
          {!data?.intentSummaries?.length && <p className="text-sm text-muted-foreground">Share a tracked brochure link to start collecting buyer intent.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tracked brochure links</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(data?.brochures ?? []).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.properties?.name} · {b.status}</p>
                <p className="mt-1 flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3 shrink-0" />
                  {shareUrl(b.slug)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => copyShareLink(b.slug)}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/brochure/${b.slug}`} target="_blank">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
