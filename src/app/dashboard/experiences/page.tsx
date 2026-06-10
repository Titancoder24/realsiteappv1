"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Compass, Globe } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { CategoryRankChart } from "@/components/category-rank-chart";
import { TrafficSourcesChart } from "@/components/traffic-sources-chart";

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<{ id: string; type: string; status: string; slug: string; properties?: { name: string }; published_url?: string; property_id?: string }[]>([]);
  const [analytics, setAnalytics] = useState<{ trafficSources?: { source: string; sessions: number }[] } | null>(null);

  useEffect(() => {
    fetch("/api/experiences").then((r) => r.json()).then(setExperiences).catch(() => {});
    fetch("/api/analytics").then((r) => (r.ok ? r.json() : null)).then((d) => d && setAnalytics(d)).catch(() => {});
  }, []);

  const published = experiences.filter((e) => e.status === "published").length;
  const is3d = (t: string) => t === "worldlabs_splat" || t === "immersive_world";
  const isCinematic = (t: string) => t === "scene_intelligence";
  const tours360 = experiences.filter((e) => !is3d(e.type) && !isCinematic(e.type)).length;
  const cinematic = experiences.filter((e) => isCinematic(e.type)).length;
  const tours3d = experiences.filter((e) => is3d(e.type)).length;

  const statusMix = useMemo(() => {
    const draft = experiences.filter((e) => e.status !== "published").length;
    const total = Math.max(1, experiences.length);
    return [
      { category: "Published", share: Math.round((published / total) * 100) },
      { category: "Draft", share: Math.round((draft / total) * 100) },
    ].filter((d) => d.share > 0);
  }, [experiences, published]);

  const typeMix = useMemo(() => {
    const total = Math.max(1, tours360 + tours3d + cinematic);
    return [
      { category: "360° Panorama", share: Math.round((tours360 / total) * 100) },
      { category: "3D Walkthrough", share: Math.round((tours3d / total) * 100) },
      { category: "Cinematic Viewer", share: Math.round((cinematic / total) * 100) },
    ].filter((d) => d.share > 0);
  }, [tours360, tours3d, cinematic]);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Virtual Tours"
        description="360° captures and 3D walkthroughs linked to your listings."
        actions={<Button className="w-full sm:w-auto" asChild><Link href="/dashboard/experiences/new">Launch 360° Capture</Link></Button>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Tours</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{experiences.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-emerald-600">{published}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">360° Captures</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{tours360}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">3D Walkthroughs</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{tours3d}</p></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {statusMix.length > 0 && <CategoryRankChart data={statusMix} title="Publish Status" description="Published vs draft tours." />}
        {typeMix.length > 0 && <CategoryRankChart data={typeMix} title="Tour Format" description="360° panorama vs 3D splat experiences." />}
        <TrafficSourcesChart
          data={analytics?.trafficSources}
          title="Tour Traffic Sources"
          description="How buyers reach your published tours."
        />
      </div>

      <div className="space-y-3">
        {experiences.map((e) => (
          <Card key={e.id} className="border-border/60">
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {isCinematic(e.type) ? <Compass className="h-5 w-5" /> : is3d(e.type) ? <Globe className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{e.properties?.name ?? "Property"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {e.type === "scene_intelligence" ? "Cinematic Property Viewer" : e.type === "immersive_world" ? "Immersive World" : is3d(e.type) ? "3D Walkthrough" : "360° Panorama Tour"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={e.status === "published" ? "success" : "secondary"}>{e.status}</Badge>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/experiences/builder?type=${e.type}&id=${e.id}&propertyId=${e.property_id ?? ""}`}>Edit Tour</Link>
                </Button>
              </div>
            </CardHeader>
            {e.published_url && <CardContent className="pt-0 text-xs text-muted-foreground break-all">{e.published_url}</CardContent>}
          </Card>
        ))}
        {!experiences.length && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <Compass className="mb-4 h-12 w-12 text-muted-foreground/40" />
              <p className="font-medium">No virtual tours yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Capture a 360° panorama or generate a 3D walkthrough for your first listing.</p>
              <Button className="mt-4" asChild><Link href="/dashboard/experiences/new">Start 360° Capture</Link></Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
