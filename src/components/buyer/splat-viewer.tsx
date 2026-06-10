"use client";

import { useEffect, useRef } from "react";

function pickSplatUrl(urls: { spz100k?: string; spz500k?: string; spzFull?: string; marbleUrl?: string }) {
  if (typeof window === "undefined") return urls.spz500k ?? urls.marbleUrl;
  const isMobile = window.innerWidth < 768;
  const lowEnd = navigator.hardwareConcurrency <= 4;
  if (isMobile && lowEnd && urls.spz100k) return urls.spz100k;
  if (isMobile && urls.spz500k) return urls.spz500k;
  return urls.spzFull ?? urls.spz500k ?? urls.spz100k ?? urls.marbleUrl;
}

export function SplatViewer({
  spz100kUrl,
  spz500kUrl,
  spzFullResUrl,
  worldMarbleUrl,
  colliderMeshUrl,
  onPositionChange,
}: {
  spz100kUrl?: string;
  spz500kUrl?: string;
  spzFullResUrl?: string;
  worldMarbleUrl?: string;
  colliderMeshUrl?: string;
  onPositionChange?: (x: number, y: number, z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!containerRef.current) return;
    const selectedUrl = pickSplatUrl({ spz100k: spz100kUrl, spz500k: spz500kUrl, spzFull: spzFullResUrl, marbleUrl: worldMarbleUrl });
    if (!selectedUrl) return;
    const splatUrl: string = selectedUrl;

    let viewer: { dispose?: () => void; camera?: { position: { x: number; y: number; z: number } } } | null = null;
    let animId = 0;
    let cancelled = false;
    const pos = { x: 0, y: 1, z: 3 };

    const onKey = (e: KeyboardEvent, down: boolean) => { keysRef.current[e.key.toLowerCase()] = down; };
    const keyDown = (e: KeyboardEvent) => onKey(e, true);
    const keyUp = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    function tick() {
      const speed = 0.05;
      if (keysRef.current.w || keysRef.current.arrowup) pos.z -= speed;
      if (keysRef.current.s || keysRef.current.arrowdown) pos.z += speed;
      if (keysRef.current.a || keysRef.current.arrowleft) pos.x -= speed;
      if (keysRef.current.d || keysRef.current.arrowright) pos.x += speed;
      onPositionChange?.(pos.x, pos.y, pos.z);
      animId = requestAnimationFrame(tick);
    }
    tick();

    async function init() {
      if (worldMarbleUrl && splatUrl === worldMarbleUrl) {
        if (containerRef.current && !cancelled) {
          containerRef.current.innerHTML = `<iframe src="${worldMarbleUrl}" class="h-full w-full border-0" allow="fullscreen" />`;
        }
        return;
      }
      try {
        const { Viewer } = await import("@mkkellogg/gaussian-splats-3d");
        if (cancelled || !containerRef.current) return;
        viewer = new Viewer({
          rootElement: containerRef.current,
          cameraUp: [0, 1, 0],
          initialCameraPosition: [pos.x, pos.y, pos.z],
          initialCameraLookAt: [0, 0, 0],
          sharedMemoryForWorkers: false,
        });
        await (viewer as { addSplatScene: (u: string) => Promise<void> }).addSplatScene(splatUrl);
        void colliderMeshUrl;
      } catch {
        if (containerRef.current && worldMarbleUrl) {
          containerRef.current.innerHTML = `<iframe src="${worldMarbleUrl}" class="h-full w-full border-0" allow="fullscreen" />`;
        }
      }
    }
    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      viewer?.dispose?.();
    };
  }, [spz100kUrl, spz500kUrl, spzFullResUrl, worldMarbleUrl, colliderMeshUrl, onPositionChange]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-black" />
      <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white/70">WASD / Arrow keys to move</p>
    </div>
  );
}
