"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExperienceTypeSelector } from "@/components/experience/experience-type-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExperienceType } from "@/types/domain";
import { toast } from "sonner";

export default function NewExperiencePage() {
  const [selected, setSelected] = useState<ExperienceType>();
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/properties")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load properties");
        return Array.isArray(data) ? data : [];
      })
      .then(setProperties)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load properties"));
  }, []);

  async function create() {
    if (!selected || !propertyId) return;
    setCreating(true);
    const res = await fetch("/api/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, type: selected }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) return toast.error(data.error);
    if (selected === "mobile_360_capture") {
      router.push(`/dashboard/capture/${data.id}?propertyId=${propertyId}`);
    } else {
      router.push(`/dashboard/experiences/builder?type=${selected}&id=${data.id}&propertyId=${propertyId}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Experience</h1>
        <p className="text-muted-foreground">Choose property and creation engine</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Property</CardTitle></CardHeader>
        <CardContent>
          <select className="w-full rounded-md border px-3 py-2 text-sm" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </CardContent>
      </Card>
      <ExperienceTypeSelector selected={selected} onSelect={setSelected} />
      <Button disabled={!selected || !propertyId || creating} onClick={create}>
        {creating ? "Creating…" : "Continue to Builder"}
      </Button>
    </div>
  );
}
