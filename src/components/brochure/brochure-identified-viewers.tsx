"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ViewerSessionDetail } from "@/components/brochure/viewer-session-detail";

interface Viewer {
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
}

export function BrochureIdentifiedViewers() {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [brochures, setBrochures] = useState<{ id: string; title: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch("/api/brochures/analytics")
      .then((r) => r.json())
      .then((d) => {
        setViewers(d.identifiedViewers ?? []);
        setBrochures((d.brochures ?? []).map((b: { id: string; title: string }) => ({ id: b.id, title: b.title })));
      })
      .catch(() => toast.error("Failed to load viewers"));
  }, []);

  const brochureMap = new Map(brochures.map((b) => [b.id, b.title]));

  const intentChart = [
    { band: "hot", count: viewers.filter((v) => v.intentBand === "hot").length },
    { band: "warm", count: viewers.filter((v) => v.intentBand === "warm").length },
    { band: "cold", count: viewers.filter((v) => v.intentBand === "cold").length },
  ].filter((d) => d.count > 0);

  function openViewer(sessionId: string) {
    setSelectedSession(sessionId);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total identified</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{viewers.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Hot buyers</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{viewers.filter((v) => v.intentBand === "hot").length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>First-time visitors</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{viewers.filter((v) => v.firstVisit).length}</div></CardContent>
        </Card>
      </div>

      {intentChart.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Viewer intent breakdown</CardTitle></CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intentChart}>
                <XAxis dataKey="band" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identified viewers</CardTitle>
          <CardDescription>Click any row to see complete stats, charts, click heatmap, and sales close actions</CardDescription>
        </CardHeader>
        <CardContent>
          {!viewers.length ? (
            <p className="text-sm text-muted-foreground">
              Every buyer must enter name and phone before viewing. Identified viewers will appear here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Buyer</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Brochure</th>
                    <th className="px-3 py-2">Visit</th>
                    <th className="px-3 py-2">Top focus</th>
                    <th className="px-3 py-2">Pages</th>
                    <th className="px-3 py-2">Device</th>
                    <th className="px-3 py-2">Intent</th>
                  </tr>
                </thead>
                <tbody>
                  {viewers.map((v) => (
                    <tr
                      key={v.sessionId}
                      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50"
                      onClick={() => openViewer(v.sessionId)}
                    >
                      <td className="px-3 py-2 font-medium">{v.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{v.phone}</td>
                      <td className="px-3 py-2">{brochureMap.get(v.brochureId ?? "") ?? "—"}</td>
                      <td className="px-3 py-2">
                        {v.firstVisit ? <Badge variant="outline">First time</Badge> : <Badge variant="secondary">Returned</Badge>}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {v.startedAt ? new Date(v.startedAt).toLocaleString() : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        {(v.topPage ?? "—").replace(/_/g, " ")}
                        {v.topDwellSeconds > 0 && (
                          <p className="text-[11px] text-muted-foreground">
                            {Math.floor(v.topDwellSeconds / 60)}m {v.topDwellSeconds % 60}s
                          </p>
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
          )}
        </CardContent>
      </Card>

      <ViewerSessionDetail
        sessionId={selectedSession}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
