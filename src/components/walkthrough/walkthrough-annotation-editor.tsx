"use client";

import { useCallback, useRef, useState } from "react";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ANNOTATION_CATEGORIES = [
  { value: "room_feature", label: "Room feature" },
  { value: "amenity", label: "Amenity" },
  { value: "material", label: "Material / finish" },
  { value: "view", label: "View" },
  { value: "pricing", label: "Pricing" },
  { value: "cta", label: "Call to action" },
  { value: "compliance", label: "Compliance" },
];

export function WalkthroughAnnotationEditor({
  scene,
  annotations,
  onAnnotationsChange,
}: {
  scene: WalkthroughScene;
  annotations: WalkthroughAnnotation[];
  onAnnotationsChange: (next: WalkthroughAnnotation[]) => void;
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
      const draft: WalkthroughAnnotation = {
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
        sort_order: annotations.length,
      };
      onAnnotationsChange([...annotations, draft]);
      setSelectedId(id);
      setPlacing(false);
      toast.success("Pin placed — save to keep it");
    },
    [placing, scene, annotations, onAnnotationsChange],
  );

  function updateSelected(patch: Partial<WalkthroughAnnotation>) {
    if (!selectedId) return;
    onAnnotationsChange(annotations.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  }

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    const isNew = !selected.created_at;
    const url = isNew
      ? `/api/walkthrough/scenes/${scene.id}/annotations`
      : `/api/walkthrough/scenes/${scene.id}/annotations/${selected.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selected.title,
        short_description: selected.short_description,
        description: selected.description,
        category: selected.category,
        x_position: selected.x_position,
        y_position: selected.y_position,
        visibility: selected.visibility,
        cta_label: selected.cta_label,
        ai_context: selected.ai_context,
        rag_enabled: selected.rag_enabled,
        crm_tracking_enabled: selected.crm_tracking_enabled,
        sort_order: selected.sort_order,
      }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Failed to save annotation");
    const saved = await res.json();
    onAnnotationsChange(annotations.map((a) => (a.id === selected.id ? saved : a)));
    setSelectedId(saved.id);
    toast.success("Pin saved");
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!selected.created_at) {
      onAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
      setSelectedId(null);
      return;
    }
    const res = await fetch(`/api/walkthrough/scenes/${scene.id}/annotations/${selected.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Failed to delete");
    onAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
    setSelectedId(null);
    toast.success("Pin removed");
  }

  return (
    <div className="wt-annotation-editor">
      <div className="wt-annotation-canvas-wrap">
        <div className="wt-annotation-toolbar">
          <p className="text-sm font-medium">{scene.title}</p>
          <button
            type="button"
            className={`wt-annotation-add-btn ${placing ? "is-active" : ""}`}
            onClick={() => setPlacing((p) => !p)}
          >
            <Plus className="h-3.5 w-3.5" />
            {placing ? "Click on image…" : "Add pin"}
          </button>
        </div>
        <div
          ref={canvasRef}
          className={`wt-annotation-canvas ${placing ? "is-placing" : ""}`}
          onClick={handleCanvasClick}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={scene.title} draggable={false} />
          {annotations.map((ann) => (
            <button
              key={ann.id}
              type="button"
              className="wt-annotation-pin"
              data-selected={selectedId === ann.id}
              style={{ left: `${ann.x_position * 100}%`, top: `${ann.y_position * 100}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(ann.id);
                setPlacing(false);
              }}
            >
              <MapPin className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="wt-annotation-inspector">
        {selected ? (
          <div className="space-y-3">
            <div>
              <label className="wt-field-label">Title</label>
              <input className="wt-input" value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} />
            </div>
            <div>
              <label className="wt-field-label">Short description</label>
              <input className="wt-input" value={selected.short_description ?? ""} onChange={(e) => updateSelected({ short_description: e.target.value })} />
            </div>
            <div>
              <label className="wt-field-label">Details</label>
              <textarea className="wt-input wt-textarea" value={selected.description ?? ""} onChange={(e) => updateSelected({ description: e.target.value })} rows={3} />
            </div>
            <div>
              <label className="wt-field-label">Category</label>
              <select className="wt-input" value={selected.category} onChange={(e) => updateSelected({ category: e.target.value })}>
                {ANNOTATION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={selected.rag_enabled} onChange={(e) => updateSelected({ rag_enabled: e.target.checked })} />
              Include in AI knowledge
            </label>
            <div className="flex gap-2">
              <button type="button" className="wt-btn-primary flex-1" onClick={saveSelected} disabled={saving}>
                {saving ? "Saving…" : "Save pin"}
              </button>
              <button type="button" className="wt-btn-ghost px-2" onClick={deleteSelected} aria-label="Delete pin">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a pin on the image or add a new one. Pins appear in the buyer walkthrough and feed the AI assistant.
          </p>
        )}
      </div>
    </div>
  );
}
