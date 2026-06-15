"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MotionSceneViewer } from "@/components/buyer/motion-scene-viewer";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  mapAICommandToPlayer,
  reducePlayerState,
  resolveKeyboardCommand,
  type WalkthroughAICommand,
  type WalkthroughPlayerCommand,
} from "@/lib/walkthrough-player-controller";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import type { PropertyScene, SceneAnnotationRecord } from "@/types/scene-intelligence";
import { ChevronDown, Footprints, LayoutGrid, MessageSquare, Pause, Phone, Play, X } from "lucide-react";

function toPropertyScene(scene: WalkthroughScene, isMobile: boolean): PropertyScene {
  const imageUrl = isMobile && scene.edited_image_url ? scene.edited_image_url : scene.image_url;
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
    motion_config: { duration: scene.duration ?? 6, easing: "ease-in-out" } as PropertyScene["motion_config"],
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

function sceneVideoUrl(scene: WalkthroughScene, isMobile: boolean) {
  if (isMobile) return scene.video_url_mobile ?? scene.video_url_720p ?? scene.video_url;
  return scene.video_url_1080p ?? scene.video_url ?? scene.video_url_720p;
}

function computeScrollState(
  container: HTMLDivElement,
  sections: (HTMLDivElement | null)[],
  sceneCount: number,
  walkMode: boolean,
) {
  const vh = container.clientHeight;
  const scrollTop = container.scrollTop;

  if (walkMode) {
    const idx = Math.min(sceneCount - 1, Math.max(0, Math.round(scrollTop / Math.max(vh, 1))));
    return { activeIndex: idx, scrubProgress: 0 };
  }

  let activeIndex = 0;
  let scrubProgress = 0;

  for (let i = 0; i < Math.min(sections.length, sceneCount); i++) {
    const section = sections[i];
    if (!section) continue;
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const scrubRange = Math.max(height - vh, 1);

    if (scrollTop >= top && scrollTop < top + height) {
      activeIndex = i;
      scrubProgress = Math.min(1, Math.max(0, (scrollTop - top) / scrubRange));
      return { activeIndex, scrubProgress };
    }
    if (scrollTop >= top + height) activeIndex = Math.min(i + 1, sceneCount - 1);
  }

  return { activeIndex, scrubProgress };
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
  onAICommand,
  externalAICommand,
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
  onAICommand?: (cmd: WalkthroughAICommand) => void;
  externalAICommand?: WalkthroughAICommand | null;
}) {
  const isMobile = useIsMobile();
  const sceneIds = scenes.map((s) => s.id);
  const [player, setPlayer] = useState<import("@/lib/walkthrough-player-controller").WalkthroughPlayerState>({
    activeIndex: 0,
    activeSceneId: scenes[0]?.id ?? null,
    walkMode: false,
    playing: true,
    highlightedAnnotationId: null,
    isTransitioning: false,
  });
  const [scrubProgress, setScrubProgress] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastTrackedIndex = useRef(0);

  const dispatch = useCallback((command: WalkthroughPlayerCommand) => {
    setPlayer((prev) => {
      const next = reducePlayerState(prev, command, scenes.length, sceneIds);
      if (command.type === "JUMP_TO_SCENE" || command.type === "JUMP_TO_INDEX" || command.type === "NEXT_SCENE" || command.type === "PREVIOUS_SCENE") {
        const idx = next.activeIndex;
        const section = sectionRefs.current[idx];
        const container = containerRef.current;
        if (section && container) {
          container.scrollTo({ top: section.offsetTop, behavior: "smooth" });
          window.setTimeout(() => {
            setPlayer((p) => ({ ...p, isTransitioning: false }));
          }, 600);
        }
        onSceneEvent?.("scene_jump", { sceneId: sceneIds[idx], index: idx, command: command.type });
      }
      if (command.type === "SET_WALK_MODE") {
        onSceneEvent?.("walk_mode_toggled", { enabled: command.enabled });
      }
      return next;
    });
  }, [scenes.length, sceneIds, onSceneEvent]);

  const trackScene = useCallback((index: number) => {
    const scene = scenes[index];
    if (scene) onSceneEvent?.("scene_started", { sceneId: scene.id, title: scene.title, index });
  }, [scenes, onSceneEvent]);

  useEffect(() => {
    trackScene(0);
    onSceneEvent?.("viewer_opened", { sceneCount: scenes.length });
    const t = setTimeout(() => setShowHint(false), 5000);
    return () => clearTimeout(t);
  }, [scenes.length, onSceneEvent, trackScene]);

  useEffect(() => {
    if (!externalAICommand) return;
    onAICommand?.(externalAICommand);
    if (externalAICommand.command === "OPEN_LEAD_FORM") {
      onContact?.();
      return;
    }
    if (externalAICommand.command === "SHOW_ROOM_MENU") {
      setShowRoomMenu(true);
      onSceneEvent?.("room_menu_opened", {});
      return;
    }
    const mapped = mapAICommandToPlayer(externalAICommand, sceneIds);
    if (mapped) dispatch(mapped);
    if (externalAICommand.command === "HIGHLIGHT_ANNOTATION") {
      dispatch({ type: "HIGHLIGHT_ANNOTATION", annotationId: externalAICommand.annotationId });
    }
  }, [externalAICommand, sceneIds, dispatch, onAICommand, onContact, onSceneEvent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      setShowHint(false);
      const { activeIndex, scrubProgress: progress } = computeScrollState(
        container,
        sectionRefs.current,
        scenes.length,
        player.walkMode,
      );

      setScrubProgress(progress);

      if (activeIndex !== lastTrackedIndex.current) {
        lastTrackedIndex.current = activeIndex;
        trackScene(activeIndex);
      }

      setPlayer((p) => (
        p.activeIndex === activeIndex && p.activeSceneId === sceneIds[activeIndex]
          ? p
          : { ...p, activeIndex, activeSceneId: sceneIds[activeIndex] ?? null }
      ));
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, [player.walkMode, scenes.length, sceneIds, trackScene]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const cmd = resolveKeyboardCommand(e.key, player.walkMode);
      if (!cmd) return;
      e.preventDefault();
      if (cmd.type === "MOVE_FORWARD") dispatch({ type: "NEXT_SCENE" });
      else if (cmd.type === "MOVE_BACKWARD") dispatch({ type: "PREVIOUS_SCENE" });
      else dispatch(cmd);
      onSceneEvent?.("keyboard_used", { key: e.key });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, player.walkMode, onSceneEvent]);

  function onTouchStart(e: React.TouchEvent) {
    if (!player.walkMode) return;
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!player.walkMode || !touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 40) {
      dispatch(dy < 0 ? { type: "NEXT_SCENE" } : { type: "PREVIOUS_SCENE" });
      onSceneEvent?.("swipe_used", { direction: dy < 0 ? "up" : "down" });
    } else if (Math.abs(dx) > 40) {
      dispatch(dx < 0 ? { type: "NEXT_SCENE" } : { type: "PREVIOUS_SCENE" });
      onSceneEvent?.("swipe_used", { direction: dx < 0 ? "left" : "right" });
    }
    touchStart.current = null;
  }

  function scrollToScene(index: number) {
    dispatch({ type: "JUMP_TO_INDEX", index });
  }

  const scrollControlled = !player.walkMode;
  const videosReady = scenes.filter((s) => sceneVideoUrl(s, isMobile)).length;
  const hasVideos = videosReady > 0;

  if (!scenes.length) {
    return <div className="flex h-[100dvh] items-center justify-center bg-black text-white">No scenes published</div>;
  }

  return (
    <div className="relative h-[100dvh] w-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
        <p className="shrink-0 text-xs font-medium text-white/80">{player.activeIndex + 1}/{scenes.length}</p>
      </div>

      <div className={`wt-room-strip ${showRoomMenu ? "wt-room-strip--expanded" : ""}`}>
        {showRoomMenu && (
          <div className="wt-room-menu-header">
            <p>Jump to a room</p>
            <button type="button" className="wt-room-menu-close" onClick={() => setShowRoomMenu(false)} aria-label="Close room menu">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`wt-room-chip ${i === player.activeIndex ? "wt-room-chip--active" : ""}`}
            onClick={() => {
              scrollToScene(i);
              setShowRoomMenu(false);
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div ref={containerRef} className={`wt-scroll-viewer h-[100dvh] ${player.walkMode ? "wt-scroll-viewer--walk-mode" : ""}`}>
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            ref={(el) => { sectionRefs.current[i] = el; }}
            className={`wt-scroll-section ${scrollControlled ? "wt-scroll-section--scrub" : ""}`}
          >
            <div className="wt-scroll-section-sticky">
              <MotionSceneViewer
                scene={toPropertyScene(scene, isMobile)}
                annotations={toAnnotations(scene.walkthrough_annotations)}
                isMobile={isMobile}
                playing={player.playing && (player.walkMode ? i === player.activeIndex : false)}
                videoUrl={sceneVideoUrl(scene, isMobile)}
                posterUrl={scene.poster_url ?? scene.thumbnail_url}
                highlightedAnnotationId={player.highlightedAnnotationId}
                scrubProgress={scrollControlled && i === player.activeIndex ? scrubProgress : 0}
                scrollControlled={scrollControlled}
                onAnnotationClick={(ann) => {
                  dispatch({ type: "HIGHLIGHT_ANNOTATION", annotationId: ann.id });
                  onSceneEvent?.("annotation_clicked", { sceneId: scene.id, annotationId: ann.id, title: ann.title });
                  const wtAnn = scene.walkthrough_annotations?.find((a) => a.id === ann.id);
                  if (wtAnn) onAnnotationClick?.(wtAnn);
                }}
              />
              <div className="wt-scroll-section-caption">
                <h2>{scene.title}</h2>
                {scene.caption && <p>{scene.caption}</p>}
              </div>
            </div>
          </div>
        ))}
        <div className={`wt-scroll-section ${scrollControlled ? "wt-scroll-section--scrub" : ""} flex items-center justify-center bg-zinc-900`}>
          <div className="wt-scroll-section-sticky flex items-center justify-center px-6">
            <div className="text-center text-white">
              <h2 className="text-xl font-semibold sm:text-2xl">Interested in this property?</h2>
              <p className="mt-2 text-sm text-white/70">Contact our sales team to schedule a visit.</p>
              <button type="button" className="wt-viewer-btn wt-viewer-btn--primary mt-6 px-8" onClick={() => onContact?.() ?? onSceneEvent?.("contact_clicked", {})}>
                Contact sales
              </button>
            </div>
          </div>
        </div>
      </div>

      {showHint && player.activeIndex === 0 && (
        <div className="wt-scroll-hint">
          <ChevronDown className="h-5 w-5" />
          <span>
            {isMobile
              ? (player.walkMode ? "Swipe to move between rooms" : "Scroll to walk through · toggle Walk Mode to jump rooms")
              : (player.walkMode ? "W/A/S/D or arrows to explore" : hasVideos ? "Scroll to scrub through each room video" : "Scroll to walk through the property")}
          </span>
        </div>
      )}

      <div className="wt-viewer-dock">
        <div className="wt-viewer-progress">
          {scenes.map((s, i) => (
            <button key={s.id} type="button" className="wt-viewer-dot" data-active={i === player.activeIndex} onClick={() => scrollToScene(i)} aria-label={`Go to ${s.title}`} />
          ))}
        </div>
        <div className="wt-viewer-controls">
          <button
            type="button"
            className={`wt-viewer-btn ${player.walkMode ? "wt-viewer-btn--primary" : ""}`}
            onClick={() => dispatch({ type: "SET_WALK_MODE", enabled: !player.walkMode })}
            aria-label="Toggle walk mode"
            title={player.walkMode ? "Walk mode on" : "Walk mode off — scroll scrubs video"}
          >
            <Footprints className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="wt-viewer-btn"
            onClick={() => setShowRoomMenu((open) => !open)}
            aria-label="Room menu"
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          {player.walkMode && (
            <button type="button" className="wt-viewer-btn" onClick={() => dispatch({ type: "SET_PLAYING", playing: !player.playing })} aria-label={player.playing ? "Pause" : "Play"}>
              {player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          )}
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
          <button type="button" className="wt-viewer-btn" onClick={() => dispatch({ type: "NEXT_SCENE" })} aria-label="Next scene">
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30 h-0.5 bg-white/15">
        <div
          className="h-full bg-white transition-[width] duration-75"
          style={{ width: `${((player.activeIndex + scrubProgress) / Math.max(scenes.length, 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}
