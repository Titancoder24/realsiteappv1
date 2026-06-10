"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOTION_PRESETS, suggestMotionForScene, type MotionType, type PropertyScene } from "@/types/scene-intelligence";
import { Sparkles } from "lucide-react";

export function SceneMotionPicker({
  scene,
  onSelect,
  saving,
}: {
  scene: PropertyScene;
  onSelect: (motionType: MotionType) => void;
  saving?: boolean;
}) {
  const recommended = suggestMotionForScene(scene.title);
  const recommendedPreset = MOTION_PRESETS.find((p) => p.type === recommended);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium">AI recommends: {recommendedPreset?.label}</p>
          <p className="text-xs text-muted-foreground">{recommendedPreset?.description}</p>
        </div>
        <Button size="sm" variant="secondary" className="shrink-0" disabled={saving} onClick={() => onSelect(recommended)}>
          Apply
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {MOTION_PRESETS.map((preset) => {
          const active = scene.motion_type === preset.type;
          return (
            <button
              key={preset.type}
              type="button"
              disabled={saving}
              onClick={() => onSelect(preset.type)}
              className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/50 ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{preset.label}</span>
                {active && <Badge variant="secondary">Selected</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
