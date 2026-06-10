"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Project = { id: string; name: string; city?: string };

function PropertiesContent() {
  const params = useSearchParams();
  const projectIdFromUrl = params.get("projectId");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromUrl ?? "");
  const [properties, setProperties] = useState<{ id: string; name: string; unit_type?: string; publish_status?: string; experiences?: { type: string; status: string }[] }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", unit_type: "", configuration: "", project_id: projectIdFromUrl ?? "" });

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setProjects(data);
        if (projectIdFromUrl) {
          setSelectedProjectId(projectIdFromUrl);
          setForm((f) => ({ ...f, project_id: projectIdFromUrl }));
        } else if (data.length === 1) {
          setSelectedProjectId(data[0].id);
          setForm((f) => ({ ...f, project_id: data[0].id }));
        }
      })
      .catch(() => {});
  }, [projectIdFromUrl]);

  useEffect(() => {
    const url = selectedProjectId ? `/api/properties?projectId=${selectedProjectId}` : "/api/properties";
    fetch(url).then((r) => r.json()).then((data) => Array.isArray(data) && setProperties(data)).catch(() => {});
  }, [selectedProjectId]);

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_id) return toast.error("Select a project first");
    const res = await fetch("/api/properties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    setProperties((p) => [data, ...p]);
    setShowForm(false);
    setForm({ name: "", unit_type: "", configuration: "", project_id: form.project_id });
    toast.success("Property created");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">Properties</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowForm(!showForm)} disabled={!projects.length}>Add Property</Button>
          <Button className="w-full sm:w-auto" asChild><Link href="/dashboard/experiences/new">Create Experience</Link></Button>
        </div>
      </div>

      {!projects.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No projects yet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a project first, then add properties under it.{" "}
              <Link href="/dashboard/projects/new" className="text-primary underline">Create project</Link>
            </p>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground" htmlFor="project-filter">Project</label>
          <select
            id="project-filter"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setForm((f) => ({ ...f, project_id: e.target.value }));
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>
            ))}
          </select>
        </div>
      )}

      {showForm && (
        <form onSubmit={createProperty} className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-2">
          <select
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm md:col-span-2"
            value={form.project_id}
            onChange={(e) => setForm({ ...form, project_id: e.target.value })}
            required
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}{p.city ? ` · ${p.city}` : ""}</option>
            ))}
          </select>
          <Input placeholder="Property name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Unit type (2BHK, 3BHK…)" value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} />
          <Input placeholder="Configuration" value={form.configuration} onChange={(e) => setForm({ ...form, configuration: e.target.value })} />
          <Button type="submit" disabled={!form.project_id}>Save Property</Button>
        </form>
      )}
      <div className="space-y-3">
        {properties.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{p.unit_type} · {p.experiences?.length ?? 0} experiences</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={p.publish_status === "published" ? "success" : "secondary"}>{p.publish_status ?? "draft"}</Badge>
                <Link href={`/dashboard/properties/${p.id}`} className="text-sm text-primary underline">Edit</Link>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  return <Suspense fallback={<p>Loading…</p>}><PropertiesContent /></Suspense>;
}
