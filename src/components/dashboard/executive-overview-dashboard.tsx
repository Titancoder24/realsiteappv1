"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowUpRight, Building2, Eye, Flame, Phone, Users } from "lucide-react";

export function ExecutiveOverviewDashboard() {
  const [stats, setStats] = useState({
    totalProjects: 0, totalProperties: 0, publishedExperiences: 0, experiences360: 0,
    experiences3d: 0, processingJobs: 0, failedGenerations: 0, buyerSessions: 0,
    hotLeads: 0, callbackRequests: 0, avgIntentScore: 0, recentEvents: [] as { event_type: string; payload?: { query?: string }; created_at: string }[],
  });

  useEffect(() => {
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  const kpis = [
    { label: "Projects", value: stats.totalProjects, icon: Building2 },
    { label: "Properties", value: stats.totalProperties, icon: Building2 },
    { label: "Published", value: stats.publishedExperiences, icon: Eye },
    { label: "360° Tours", value: stats.experiences360, icon: Eye },
    { label: "3D Walkthroughs", value: stats.experiences3d, icon: Eye },
    { label: "Processing", value: stats.processingJobs, icon: ArrowUpRight },
    { label: "Buyer Sessions", value: stats.buyerSessions, icon: Users },
    { label: "Hot Leads", value: stats.hotLeads, icon: Flame },
    { label: "Callbacks", value: stats.callbackRequests, icon: Phone },
    { label: "Avg Intent", value: `${stats.avgIntentScore}%`, icon: Flame },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Executive Overview</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Spatial sales performance across your portfolio</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" asChild><Link href="/dashboard/experiences/new">Create Experience</Link></Button>
          <Button className="w-full sm:w-auto" asChild><Link href="/dashboard/projects/new">Add Project</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{kpi.label}</CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{kpi.value}</div></CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent High-Intent Events</CardTitle>
            <CardDescription>Live from buyer sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {!stats.recentEvents.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Users className="mb-4 h-10 w-10 text-muted-foreground" />
                <p className="font-medium">No buyer sessions yet</p>
                <Button className="mt-4" asChild><Link href="/dashboard/experiences">Publish Experience</Link></Button>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentEvents.map((e, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{e.event_type.replace(/_/g, " ")}</p>
                      {e.payload?.query && <p className="text-xs text-muted-foreground">{e.payload.query}</p>}
                    </div>
                    <Badge variant="secondary">{new Date(e.created_at).toLocaleTimeString()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Engine Health</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between"><span className="text-sm">360° Engine</span><Badge variant="success">Online</Badge></div>
            <div className="flex justify-between"><span className="text-sm">3D Walkthrough</span><Badge variant="success">Online</Badge></div>
            <div className="flex justify-between"><span className="text-sm">Failed Jobs</span><Badge variant={stats.failedGenerations > 0 ? "destructive" : "secondary"}>{stats.failedGenerations}</Badge></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
