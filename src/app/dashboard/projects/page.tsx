"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; city?: string; properties?: { count: number }[] }[]>([]);

  useEffect(() => {
    fetch("/api/projects").then((r) => r.json()).then(setProjects).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">Projects</h1>
        <Button className="w-full sm:w-auto" asChild><Link href="/dashboard/projects/new">Create Project</Link></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{p.name}</CardTitle>
              {p.city && <Badge>{p.city}</Badge>}
            </CardHeader>
            <CardContent className="flex justify-between text-sm text-muted-foreground">
              <span>{Array.isArray(p.properties) ? p.properties.length : 0} properties</span>
              <Link href={`/dashboard/properties?projectId=${p.id}`} className="text-primary underline">View properties</Link>
            </CardContent>
          </Card>
        ))}
        {!projects.length && <p className="text-muted-foreground">No projects yet. Create your first project.</p>}
      </div>
    </div>
  );
}
