"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";

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
  brochures: { id: string; title: string; slug: string; status: string; properties?: { name: string } }[];
}

export function BrochureIntelligenceDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [uploading, setUploading] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [pageCount, setPageCount] = useState("8");

  const load = () => {
    fetch("/api/brochures/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load brochure analytics"));
  };

  useEffect(() => { load(); }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !propertyId || !title) return toast.error("Property ID, title, and PDF required");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("propertyId", propertyId);
    form.append("title", title);
    form.append("pageCount", pageCount);
    const res = await fetch("/api/brochures", { method: "POST", body: form });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) return toast.error(json.error ?? "Upload failed");
    toast.success("Brochure uploaded");
    await fetch(`/api/brochures/${json.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    load();
  }

  const chartData = (data?.topPages ?? []).map((p) => ({
    name: p.category.replace(/_/g, " "),
    seconds: p.totalDwell,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Buyer Intent Analytics</h1>
        <p className="text-sm text-muted-foreground">Know which buyer is serious before your competitor calls them — property brochure intelligence.</p>
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
            <Input placeholder="Property UUID" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} />
            <Input placeholder="Brochure title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Page count" value={pageCount} onChange={(e) => setPageCount(e.target.value)} />
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload PDF brochure"}
              <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} disabled={uploading} />
            </label>
          </CardContent>
        </Card>
      </div>

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
              <div>
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.properties?.name} · {b.status}</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/brochure/${b.slug}`} target="_blank">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
