"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

const INTENT_COLORS = ["hsl(var(--primary))", "#f59e0b", "#94a3b8"];

interface Analytics {
  brochureCount: number;
  identifiedViewers: { sessionId: string; name: string; intentBand: string; intentScore: number }[];
  hotBuyers: number;
  topPages: { category: string; totalDwell: number; views: number }[];
  intentSummaries: {
    id: string;
    intent_score: number;
    intent_band: string;
    summary_text?: string;
    recommended_action?: string;
  }[];
  salesAlerts: { id: string; alert_type: string; message: string; intent_band: string }[];
  deviceBreakdown: { device: string; count: number }[];
  intentDistribution: { band: string; count: number }[];
}

export function BrochureIntelligenceOverview() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/brochures/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load intelligence data"));
  }, []);

  const chartData = (data?.topPages ?? []).map((p) => ({
    name: p.category.replace(/_/g, " "),
    seconds: p.totalDwell,
    views: p.views,
  }));

  const deviceData = data?.deviceBreakdown ?? [];
  const intentData = (data?.intentDistribution ?? []).filter((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Brochures", value: data?.brochureCount ?? 0 },
          { label: "Identified viewers", value: data?.identifiedViewers?.length ?? 0 },
          { label: "Hot buyers", value: data?.hotBuyers ?? 0 },
          { label: "Top section", value: data?.topPages?.[0]?.category?.replace(/_/g, " ") ?? "—" },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardDescription>{k.label}</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold capitalize">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Section engagement (dwell time)</CardTitle></CardHeader>
          <CardContent className="h-72">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="seconds" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Seconds" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Charts appear after viewers engage with brochures.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Intent distribution</CardTitle></CardHeader>
          <CardContent className="h-72">
            {intentData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={intentData} dataKey="count" nameKey="band" cx="50%" cy="50%" outerRadius={90} label>
                    {intentData.map((_, i) => <Cell key={i} fill={INTENT_COLORS[i % INTENT_COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Intent scores generate after identified sessions.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Device breakdown</CardTitle></CardHeader>
          <CardContent className="h-64">
            {deviceData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviceData}>
                  <XAxis dataKey="device" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Device data captured on each session.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sales alerts</CardTitle></CardHeader>
          <CardContent className="max-h-64 space-y-3 overflow-y-auto">
            {(data?.salesAlerts ?? []).slice(0, 10).map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Badge>{a.alert_type.replace(/_/g, " ")}</Badge>
                  <Badge variant="outline">{a.intent_band}</Badge>
                </div>
                <p className="text-sm">{a.message}</p>
              </div>
            ))}
            {!data?.salesAlerts?.length && <p className="text-sm text-muted-foreground">Hot buyer and re-open alerts appear here.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI sales intelligence</CardTitle>
          <CardDescription>What each buyer cared about and how to close the sale</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {(data?.intentSummaries ?? []).slice(0, 8).map((s) => (
            <div key={s.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant={s.intent_band === "hot" ? "default" : "secondary"}>{s.intent_band} intent</Badge>
                <div className="w-28">
                  <Progress value={s.intent_score} />
                  <p className="mt-1 text-center text-xs">{s.intent_score}/100</p>
                </div>
              </div>
              <p className="text-sm">{s.summary_text}</p>
              {s.recommended_action && (
                <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs font-medium text-primary">
                  Close: {s.recommended_action}
                </p>
              )}
            </div>
          ))}
          {!data?.intentSummaries?.length && (
            <p className="text-sm text-muted-foreground">AI summaries generate after identified viewers engage.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
