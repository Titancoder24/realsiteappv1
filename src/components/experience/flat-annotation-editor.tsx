"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ANNOTATION_CATEGORIES, type PropertyScene, type SceneAnnotationRecord } from "@/types/scene-intelligence";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function FlatAnnotationEditor({
  scene,
  annotations,
  onAnnotationsChange,
}: {
  scene: PropertyScene;
  annotations: SceneAnnotationRecord[];
  onAnnotationsChange: (next: SceneAnnotationRecord[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [placing, setPlacing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = annotations.find((a) => a.id === selectedId) ?? null;
  const imageUrl = scene.edited_image_url || scene.image_url;

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placing || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const id = crypto.randomUUID();
      const draft: SceneAnnotationRecord = {
        id,
        scene_id: scene.id,
        property_id: scene.property_id,
        experience_id: scene.experience_id,
        title: "New pin",
        category: "room_feature",
        x_position: Math.min(1, Math.max(0, x)),
        y_position: Math.min(1, Math.max(0, y)),
        visibility: "public",
        rag_enabled: true,
        crm_tracking_enabled: true,
      };
      onAnnotationsChange([...annotations, draft]);
      setSelectedId(id);
      setPlacing(false);
      toast.success("Pin placed — add details below");
    },
    [placing, scene, annotations, onAnnotationsChange],
  );

  function updateSelected(patch: Partial<SceneAnnotationRecord>) {
    if (!selectedId) return;
    onAnnotationsChange(annotations.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    const isNew = !selected.created_at;
    const url = isNew
      ? `/api/property-scenes/${scene.id}/annotations`
      : `/api/property-scenes/${scene.id}/annotations/${selected.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selected),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Failed to save annotation");
    const saved = await res.json();
    onAnnotationsChange(annotations.map((a) => (a.id === selected.id ? saved : a)));
    setSelectedId(saved.id);
    toast.success("Annotation saved to RAG");
  }

  async function deleteSelected() {
    if (!selected?.created_at) {
      onAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
      setSelectedId(null);
      return;
    }
    const res = await fetch(`/api/property-scenes/${scene.id}/annotations/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete");
    onAnnotationsChange(annotations.filter((a) => a.id !== selected.id));
    setSelectedId(null);
    toast.success("Annotation removed");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-xl border bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-sm font-medium">Object pins — {scene.title}</p>
        <Button size="sm" variant={placing ? "default" : "outline"} onClick={() => setPlacing((p) => !p)}>
          <Plus className="mr-1 h-4 w-4" />
          {placing ? "Tap object on image…" : "Add pin"}
        </Button>
      </div>

      <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_280px]">
        <div
          ref={canvasRef}
          className={`relative aspect-video cursor-crosshair overflow-hidden rounded-xl bg-black ${placing ? "ring-2 ring-primary" : ""}`}
          onClick={handleCanvasClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={scene.title} className="h-full w-full object-cover" draggable={false} />
          {annotations.map((ann) => (
            <button
              key={ann.id}
              type="button"
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white/90 p-1 shadow-lg transition-transform hover:scale-110 ${selectedId === ann.id ? "border-primary ring-2 ring-primary" : "border-white"}`}
              style={{ left: `${ann.x_position * 100}%`, top: `${ann.y_position * 100}%` }}
              onClick={(e) => { e.stopPropagation(); setSelectedId(ann.id); setPlacing(false); }}
            >
              <MapPin className="h-4 w-4 text-primary" />
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto">
          {selected ? (
            <>
              <div>
                <Label>What is this?</Label>
                <Input value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} />
              </div>
              <div>
                <Label>Short description</Label>
                <Input value={selected.short_description ?? ""} onChange={(e) => updateSelected({ short_description: e.target.value })} />
              </div>
              <div>
                <Label>Detailed description</Label>
                <Textarea value={selected.description ?? ""} onChange={(e) => updateSelected({ description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={selected.category}
                  onChange={(e) => updateSelected({ category: e.target.value as SceneAnnotationRecord["category"] })}
                >
                  {ANNOTATION_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.rag_enabled} onChange={(e) => updateSelected({ rag_enabled: e.target.checked })} />
                Should AI know this?
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.visibility === "public"} onChange={(e) => updateSelected({ visibility: e.target.checked ? "public" : "internal" })} />
                Should buyers see this?
              </label>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveSelected} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                <Button variant="destructive" size="icon" onClick={deleteSelected}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              <p>Select a pin or tap <strong>Add pin</strong> then click an object in the scene.</p>
              <div className="mt-3 space-y-1">
                {annotations.map((a) => (
                  <button key={a.id} type="button" className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted" onClick={() => setSelectedId(a.id)}>
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="truncate">{a.title}</span>
                    {!a.created_at && <Badge variant="outline" className="text-[10px]">Draft</Badge>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
