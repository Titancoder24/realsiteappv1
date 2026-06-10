"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExperienceTypeSelector } from "@/components/experience/experience-type-selector";
import "@/styles/scene-studio.css";
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
    <div className="mx-auto max-w-5xl space-y-6 experience-picker">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create experience</h1>
        <p className="mt-1 text-sm text-[#71717a]">Select a property, then choose how buyers will explore the listing.</p>
      </div>
      <div className="picker-card p-4">
        <label className="picker-section-label">Property</label>
        <select className="studio-input mt-1" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">Select property</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <ExperienceTypeSelector selected={selected} onSelect={setSelected} />
      <button
        type="button"
        className="studio-btn-primary px-5 py-2.5 disabled:opacity-40"
        disabled={!selected || !propertyId || creating}
        onClick={create}
      >
        {creating ? "Creating…" : "Continue to builder"}
      </button>
    </div>
  );
}
