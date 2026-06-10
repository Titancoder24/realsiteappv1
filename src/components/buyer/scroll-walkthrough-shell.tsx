"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MotionSceneViewer } from "@/components/buyer/motion-scene-viewer";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import type { PropertyScene, SceneAnnotationRecord } from "@/types/scene-intelligence";
import { ChevronDown, MessageSquare, Pause, Play } from "lucide-react";

function toPropertyScene(scene: WalkthroughScene): PropertyScene {
  return {
    id: scene.id,
    experience_id: scene.experience_id,
    property_id: scene.property_id,
    title: scene.title,
    description: scene.description ?? undefined,
    image_url: scene.image_url,
    edited_image_url: scene.edited_image_url ?? undefined,
    thumbnail_url: scene.thumbnail_url ?? undefined,
    scene_order: scene.scene_order,
    is_start_scene: scene.is_start_scene,
    motion_type: scene.motion_type as PropertyScene["motion_type"],
    motion_config: { duration: scene.duration ?? 5, easing: "ease-in-out" } as PropertyScene["motion_config"],
    duration: scene.duration,
    edit_config: {} as PropertyScene["edit_config"],
    mobile_crop: scene.mobile_crop ?? { x: 0, y: 0, width: 1, height: 1 },
    desktop_crop: scene.desktop_crop ?? { x: 0, y: 0, width: 1, height: 1 },
    ai_context: scene.ai_context ?? undefined,
  };
}

function toAnnotations(anns: WalkthroughAnnotation[] = []): SceneAnnotationRecord[] {
  return anns.map((a) => ({
    id: a.id,
    scene_id: a.scene_id,
    property_id: a.property_id,
    experience_id: a.experience_id,
    title: a.title,
    short_description: a.short_description ?? undefined,
    description: a.description ?? undefined,
    category: a.category as SceneAnnotationRecord["category"],
    x_position: a.x_position,
    y_position: a.y_position,
    visibility: a.visibility as SceneAnnotationRecord["visibility"],
    cta_type: a.cta_type ?? undefined,
    cta_label: a.cta_label ?? undefined,
    media_url: a.media_url ?? undefined,
    ai_context: a.ai_context ?? undefined,
    rag_enabled: a.rag_enabled,
    rag_entry_id: a.rag_entry_id ?? undefined,
    crm_tracking_enabled: a.crm_tracking_enabled,
    sort_order: a.sort_order,
  }));
}

export function ScrollWalkthroughShell({
  scenes,
  projectName,
  propertyName,
  brandColor,
  logoUrl,
  onAnnotationClick,
  onSceneEvent,
  onAskAI,
}: {
  scenes: WalkthroughScene[];
  projectName: string;
  propertyName: string;
  brandColor?: string;
  logoUrl?: string;
  onAnnotationClick?: (ann: WalkthroughAnnotation) => void;
  onSceneEvent?: (type: string, payload?: Record<string, unknown>) => void;
  onAskAI?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const trackScene = useCallback((index: number) => {
    const scene = scenes[index];
    if (scene) onSceneEvent?.("scene_started", { sceneId: scene.id, title: scene.title, index });
  }, [scenes, onSceneEvent]);

  useEffect(() => {
    trackScene(0);
    onSceneEvent?.("viewer_opened", { sceneCount: scenes.length });
  }, [scenes.length, onSceneEvent, trackScene]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const scrollTop = container.scrollTop;
      const vh = window.innerHeight;
      const idx = Math.round(scrollTop / vh);
      if (idx !== activeIndex && idx >= 0 && idx < scenes.length) {
        setActiveIndex(idx);
        trackScene(idx);
      }
      const sectionProgress = (scrollTop % vh) / vh;
      setScrollProgress(sectionProgress);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [activeIndex, scenes.length, trackScene]);

  function scrollToScene(index: number) {
    sectionRefs.current[index]?.scrollIntoView({ behavior: "smooth" });
  }

  if (!scenes.length) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">No scenes published</div>;
  }

  return (
    <div className="relative h-screen w-full">
      <div className="absolute left-0 right-0 top-0 z-40 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
          )}
          <div>
            <p className="text-xs text-white/70">{projectName}</p>
            <p className="font-semibold text-white" style={brandColor ? { color: brandColor } : undefined}>{propertyName}</p>
          </div>
        </div>
        <p className="text-sm text-white/80">{activeIndex + 1} / {scenes.length}</p>
      </div>

      <div ref={containerRef} className="wt-scroll-viewer h-screen">
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            ref={(el) => { sectionRefs.current[i] = el; }}
            className="wt-scroll-section"
          >
            <MotionSceneViewer
              scene={toPropertyScene(scene)}
              annotations={toAnnotations(scene.walkthrough_annotations)}
              playing={playing && i === activeIndex}
              onProgress={i === activeIndex ? setScrollProgress : undefined}
              onAnnotationClick={(ann) => {
                onSceneEvent?.("annotation_clicked", { sceneId: scene.id, annotationId: ann.id, title: ann.title });
                const wtAnn = scene.walkthrough_annotations?.find((a) => a.id === ann.id);
                if (wtAnn) onAnnotationClick?.(wtAnn);
              }}
            />
            <div className="absolute bottom-24 left-4 right-4 z-30">
              <h2 className="text-2xl font-semibold text-white drop-shadow-lg">{scene.title}</h2>
              {scene.caption && <p className="mt-1 text-sm text-white/80">{scene.caption}</p>}
            </div>
          </div>
        ))}
        <div className="wt-scroll-section flex items-center justify-center bg-zinc-900">
          <div className="text-center text-white">
            <h2 className="text-2xl font-semibold">Interested in this property?</h2>
            <p className="mt-2 text-white/70">Contact our sales team to schedule a visit.</p>
            <Button className="mt-6" size="lg" onClick={() => onSceneEvent?.("contact_clicked", {})}>
              Contact sales
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-40 flex items-center justify-between gap-3">
        <div className="flex gap-1">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`h-1 flex-1 rounded-full ${i === activeIndex ? "bg-white" : "bg-white/30"}`}
              onClick={() => scrollToScene(i)}
              aria-label={s.title}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          {onAskAI && (
            <Button size="icon" variant="secondary" className="rounded-full" onClick={onAskAI}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="secondary" className="rounded-full" onClick={() => scrollToScene(Math.min(activeIndex + 1, scenes.length - 1))}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 h-1 bg-white/20">
        <div className="h-full bg-white transition-all" style={{ width: `${((activeIndex + scrollProgress) / scenes.length) * 100}%` }} />
      </div>
    </div>
  );
}
