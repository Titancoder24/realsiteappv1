"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ExperiencesPage() {
  const [experiences, setExperiences] = useState<{ id: string; type: string; status: string; slug: string; properties?: { name: string }; published_url?: string }[]>([]);

  useEffect(() => {
    fetch("/api/experiences").then((r) => r.json()).then(setExperiences).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">Experiences</h1>
        <Button className="w-full sm:w-auto" asChild><Link href="/dashboard/experiences/new">Create Experience</Link></Button>
      </div>
      <div className="space-y-3">
        {experiences.map((e) => (
          <Card key={e.id}>
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base">{e.properties?.name ?? "Property"}</CardTitle>
                <p className="text-sm text-muted-foreground">{e.type === "worldlabs_splat" ? "3D Walkthrough" : "360° Tour"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge variant={e.status === "published" ? "success" : "secondary"}>{e.status}</Badge>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/dashboard/experiences/builder?type=${e.type}&id=${e.id}&propertyId=${(e as { property_id?: string }).property_id ?? ""}`}>Edit</Link>
                </Button>
              </div>
            </CardHeader>
            {e.published_url && <CardContent className="pt-0 text-xs text-muted-foreground">{e.published_url}</CardContent>}
          </Card>
        ))}
      </div>
    </div>
  );
}
