"use client";

import { useEffect, useRef, useState } from "react";
import { getMotionKeyframes, interpolateMotion, mapPinToScreen } from "@/lib/motion/motion-keyframes";
import type { CropRect, MotionType, PropertyScene, SceneAnnotationRecord, SceneEditConfig } from "@/types/scene-intelligence";
import { MapPin } from "lucide-react";

function editStyle(edit: SceneEditConfig = {}) {
  const filters = [
    edit.brightness != null ? `brightness(${edit.brightness}%)` : null,
    edit.contrast != null ? `contrast(${edit.contrast}%)` : null,
  ].filter(Boolean).join(" ");
  return {
    filter: filters || undefined,
    transform: edit.rotation ? `rotate(${edit.rotation}deg)` : undefined,
  };
}

export function MotionSceneViewer({
  scene,
  annotations = [],
  isMobile = false,
  playing = true,
  onProgress,
  onAnnotationClick,
}: {
  scene: PropertyScene;
  annotations?: SceneAnnotationRecord[];
  isMobile?: boolean;
  playing?: boolean;
  onProgress?: (progress: number) => void;
  onAnnotationClick?: (ann: SceneAnnotationRecord) => void;
}) {
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const duration = (scene.motion_config?.duration ?? scene.duration ?? 8) * 1000;
  const motionType = (scene.motion_type ?? "push_in") as MotionType;
  const keyframes = getMotionKeyframes(motionType, scene.motion_config?.intensity ?? 1);
  const frame = interpolateMotion(keyframes, progress);
  const crop = (isMobile ? scene.mobile_crop : scene.desktop_crop) as CropRect ?? { x: 0, y: 0, width: 1, height: 1 };
  const imageUrl = scene.edited_image_url || scene.image_url;

  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now();
    const tick = (now: number) => {
      if (!startRef.current) return;
      const p = ((now - startRef.current) % duration) / duration;
      setProgress(p);
      onProgress?.(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, duration, scene.id, onProgress]);

  const imgTransform = `scale(${frame.scale}) translate(${frame.translateX}%, ${frame.translateY}%) rotate(${frame.rotate}deg)`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div className="absolute inset-0 flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={scene.title}
          className="h-full w-full object-cover transition-none will-change-transform"
          style={{
            ...editStyle(scene.edit_config),
            transform: imgTransform,
            objectPosition: `${(crop.x + crop.width / 2) * 100}% ${(crop.y + crop.height / 2) * 100}%`,
          }}
          draggable={false}
        />
      </div>

      {annotations.filter((a) => a.visibility === "public").map((ann) => {
        const pos = mapPinToScreen(ann.x_position, ann.y_position, frame, crop);
        return (
          <button
            key={ann.id}
            type="button"
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-white bg-primary/90 shadow-lg hover:scale-110 ${isMobile ? "wt-pin-mobile p-2" : "p-1.5"}`}
            style={{ left: pos.left, top: pos.top }}
            onClick={() => onAnnotationClick?.(ann)}
            aria-label={ann.title}
          >
            <MapPin className={`text-white ${isMobile ? "h-5 w-5" : "h-4 w-4"}`} />
          </button>
        );
      })}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
        <p className="text-lg font-semibold text-white">{scene.title}</p>
        {scene.description && <p className="text-sm text-white/70">{scene.description}</p>}
      </div>
    </div>
  );
}
