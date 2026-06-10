"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUpload } from "@/components/shared/media-upload";
import type { PropertyScene, SceneEditConfig } from "@/types/scene-intelligence";

function editStyle(edit: SceneEditConfig) {
  const filters = [
    edit.brightness != null ? `brightness(${edit.brightness}%)` : null,
    edit.contrast != null ? `contrast(${edit.contrast}%)` : null,
    edit.saturation != null ? `saturate(${edit.saturation}%)` : null,
  ].filter(Boolean).join(" ");
  return {
    filter: filters || undefined,
    transform: edit.rotation ? `rotate(${edit.rotation}deg)` : undefined,
  };
}

export function SceneEditorPanel({
  scene,
  propertyId,
  onChange,
  onSave,
  saving,
}: {
  scene: PropertyScene;
  propertyId: string;
  onChange: (patch: Partial<PropertyScene>) => void;
  onSave: () => void;
  saving?: boolean;
}) {
  const edit = scene.edit_config ?? {};
  const imageUrl = scene.edited_image_url || scene.image_url;

  function updateEdit(patch: Partial<SceneEditConfig>) {
    onChange({ edit_config: { ...edit, ...patch } });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={scene.title}
          className="h-full w-full object-cover"
          style={editStyle(edit)}
        />
      </div>

      <div className="space-y-4">
        <div>
          <Label>Scene title</Label>
          <Input value={scene.title} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
        <div>
          <Label>Scene description</Label>
          <Textarea
            value={scene.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="What does this scene show?"
            rows={2}
          />
        </div>
        <div>
          <Label>AI context (RAG)</Label>
          <Textarea
            value={scene.ai_context ?? ""}
            onChange={(e) => onChange({ ai_context: e.target.value })}
            placeholder="Scene-level knowledge for AI answers"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Brightness ({edit.brightness ?? 100}%)</Label>
            <input
              type="range"
              min={50}
              max={150}
              value={edit.brightness ?? 100}
              onChange={(e) => updateEdit({ brightness: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <Label className="text-xs">Contrast ({edit.contrast ?? 100}%)</Label>
            <input
              type="range"
              min={50}
              max={150}
              value={edit.contrast ?? 100}
              onChange={(e) => updateEdit({ contrast: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <Label className="text-xs">Rotation ({edit.rotation ?? 0}°)</Label>
            <input
              type="range"
              min={-15}
              max={15}
              value={edit.rotation ?? 0}
              onChange={(e) => updateEdit({ rotation: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div>
          <Label>Replace image</Label>
          <MediaUpload
            propertyId={propertyId}
            onUploaded={(a) => onChange({ image_url: a.file_url, edited_image_url: a.file_url, thumbnail_url: a.file_url })}
          />
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save scene edits"}
        </Button>
      </div>
    </div>
  );
}
