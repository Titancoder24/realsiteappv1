"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotionSceneViewer } from "@/components/buyer/motion-scene-viewer";
import { useIsMobile } from "@/hooks/use-mobile";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import type { PropertyScene, SceneAnnotationRecord } from "@/types/scene-intelligence";
import { ChevronDown, MessageSquare, Pause, Phone, Play } from "lucide-react";

function toPropertyScene(scene: WalkthroughScene, isMobile: boolean): PropertyScene {
  const imageUrl = isMobile && scene.edited_image_url
    ? scene.edited_image_url
    : scene.image_url;

  return {
    id: scene.id,
    experience_id: scene.experience_id,
    property_id: scene.property_id,
    title: scene.title,
    description: scene.description ?? undefined,
    image_url: imageUrl,
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
  onContact,
}: {
  scenes: WalkthroughScene[];
  projectName: string;
  propertyName: string;
  brandColor?: string;
  logoUrl?: string;
  onAnnotationClick?: (ann: WalkthroughAnnotation) => void;
  onSceneEvent?: (type: string, payload?: Record<string, unknown>) => void;
  onAskAI?: () => void;
  onContact?: () => void;
}) {
  const isMobile = useIsMobile();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const trackScene = useCallback((index: number) => {
    const scene = scenes[index];
    if (scene) onSceneEvent?.("scene_started", { sceneId: scene.id, title: scene.title, index });
  }, [scenes, onSceneEvent]);

  useEffect(() => {
    trackScene(0);
    onSceneEvent?.("viewer_opened", { sceneCount: scenes.length });
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, [scenes.length, onSceneEvent, trackScene]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      setShowHint(false);
      const vh = container.clientHeight;
      const idx = Math.min(scenes.length - 1, Math.max(0, Math.round(container.scrollTop / vh)));
      if (idx !== activeIndex) {
        setActiveIndex(idx);
        trackScene(idx);
      }
      const sectionProgress = vh > 0 ? (container.scrollTop % vh) / vh : 0;
      setScrollProgress(sectionProgress);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [activeIndex, scenes.length, trackScene]);

  function scrollToScene(index: number) {
    const container = containerRef.current;
    const section = sectionRefs.current[index];
    if (container && section) {
      container.scrollTo({ top: section.offsetTop, behavior: "smooth" });
    }
  }

  if (!scenes.length) {
    return <div className="flex h-[100dvh] items-center justify-center bg-black text-white">No scenes published</div>;
  }

  return (
    <div className="relative h-[100dvh] w-full">
      <div className="wt-viewer-header">
        <div className="flex min-w-0 items-center gap-2.5">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0">
            <p className="wt-viewer-subtitle truncate">{projectName}</p>
            <p className="wt-viewer-title truncate" style={brandColor ? { color: brandColor } : undefined}>{propertyName}</p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-medium text-white/80">{activeIndex + 1}/{scenes.length}</p>
      </div>

      <div ref={containerRef} className="wt-scroll-viewer h-[100dvh]">
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            ref={(el) => { sectionRefs.current[i] = el; }}
            className="wt-scroll-section"
          >
            <MotionSceneViewer
              scene={toPropertyScene(scene, isMobile)}
              annotations={toAnnotations(scene.walkthrough_annotations)}
              isMobile={isMobile}
              playing={playing && i === activeIndex}
              onProgress={i === activeIndex ? setScrollProgress : undefined}
              onAnnotationClick={(ann) => {
                onSceneEvent?.("annotation_clicked", { sceneId: scene.id, annotationId: ann.id, title: ann.title });
                const wtAnn = scene.walkthrough_annotations?.find((a) => a.id === ann.id);
                if (wtAnn) onAnnotationClick?.(wtAnn);
              }}
            />
            <div className="wt-scene-caption">
              <h2>{scene.title}</h2>
              {scene.caption && <p>{scene.caption}</p>}
            </div>
          </div>
        ))}
        <div className="wt-scroll-section flex items-center justify-center bg-zinc-900 px-6">
          <div className="text-center text-white">
            <h2 className="text-xl font-semibold sm:text-2xl">Interested in this property?</h2>
            <p className="mt-2 text-sm text-white/70">Contact our sales team to schedule a visit.</p>
            <button
              type="button"
              className="wt-viewer-btn wt-viewer-btn--primary mt-6 px-8"
              onClick={() => onContact?.() ?? onSceneEvent?.("contact_clicked", {})}
            >
              Contact sales
            </button>
          </div>
        </div>
      </div>

      {showHint && activeIndex === 0 && (
        <div className="wt-scroll-hint">
          <ChevronDown className="h-5 w-5" />
          <span>Scroll to explore</span>
        </div>
      )}

      <div className="wt-viewer-dock">
        <div className="wt-viewer-progress">
          {scenes.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className="wt-viewer-dot"
              data-active={i === activeIndex}
              onClick={() => scrollToScene(i)}
              aria-label={`Go to ${s.title}`}
            />
          ))}
        </div>
        <div className="wt-viewer-controls">
          <button type="button" className="wt-viewer-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          {onAskAI && (
            <button type="button" className="wt-viewer-btn wt-viewer-btn--primary" onClick={onAskAI} aria-label="Ask AI">
              <MessageSquare className="h-5 w-5" />
            </button>
          )}
          {onContact && (
            <button type="button" className="wt-viewer-btn" onClick={onContact} aria-label="Contact sales">
              <Phone className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            className="wt-viewer-btn"
            onClick={() => scrollToScene(Math.min(activeIndex + 1, scenes.length - 1))}
            aria-label="Next scene"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 h-0.5 bg-white/15">
        <div
          className="h-full bg-white transition-[width] duration-150"
          style={{ width: `${((activeIndex + scrollProgress) / Math.max(scenes.length, 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
