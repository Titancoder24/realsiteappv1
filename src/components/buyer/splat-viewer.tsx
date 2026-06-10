"use client";

import { useEffect, useRef, useState } from "react";

function pickSplatUrl(urls: { spz100k?: string; spz500k?: string; spzFull?: string; marbleUrl?: string }) {
  if (typeof window === "undefined") return urls.spz500k ?? urls.marbleUrl;
  const isMobile = window.innerWidth < 768;
  const lowEnd = navigator.hardwareConcurrency <= 4;
  if (isMobile && lowEnd && urls.spz100k) return urls.spz100k;
  if (isMobile && urls.spz500k) return urls.spz500k;
  return urls.spzFull ?? urls.spz500k ?? urls.spz100k ?? urls.marbleUrl;
}

function isSpzAsset(url?: string, format?: string) {
  if (format === "spz") return true;
  return Boolean(url && /\.spz(\?|$)/i.test(url));
}

export function SplatViewer({
  spz100kUrl,
  spz500kUrl,
  spzFullResUrl,
  worldMarbleUrl,
  colliderMeshUrl,
  viewerUrl,
  splatFormat,
  onPositionChange,
}: {
  spz100kUrl?: string;
  spz500kUrl?: string;
  spzFullResUrl?: string;
  worldMarbleUrl?: string;
  colliderMeshUrl?: string;
  viewerUrl?: string;
  splatFormat?: string;
  onPositionChange?: (x: number, y: number, z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useIframe, setUseIframe] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const selectedUrl = pickSplatUrl({
      spz100k: spz100kUrl,
      spz500k: spz500kUrl,
      spzFull: spzFullResUrl,
      marbleUrl: worldMarbleUrl,
    });

    if (!selectedUrl && viewerUrl) {
      setUseIframe(true);
      setLoading(false);
      return;
    }

    if (!selectedUrl) {
      setLoadError("No 3D world file available.");
      setLoading(false);
      return;
    }

    setUseIframe(false);
    setLoadError(null);
    setLoading(true);
    setLoadProgress(0);

    const useSpark = isSpzAsset(selectedUrl, splatFormat);
    let disposed = false;
    let animId = 0;
    let cleanup: (() => void) | undefined;

    async function initSpark() {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");

      if (disposed || !containerRef.current) return;

      const container = containerRef.current;
      container.innerHTML = "";

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);

      const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
      camera.position.set(0, 1.2, 3);

      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      const spark = new SparkRenderer({ renderer });
      scene.add(spark);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(0, 0, 0);

      const splatMesh = new SplatMesh({
        url: selectedUrl!,
        onProgress: (event: ProgressEvent) => {
          if (event.lengthComputable && event.total > 0) {
            setLoadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          }
        },
        onLoad: () => {
          setLoadProgress(100);
          setLoading(false);
        },
      });
      splatMesh.quaternion.set(1, 0, 0, 0);
      scene.add(splatMesh);

      const resize = () => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(container);

      const animate = () => {
        if (disposed) return;
        controls.update();
        onPositionChange?.(camera.position.x, camera.position.y, camera.position.z);
        renderer.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animate();

      cleanup = () => {
        ro.disconnect();
        cancelAnimationFrame(animId);
        controls.dispose();
        renderer.dispose();
        container.innerHTML = "";
      };
    }

    async function initLegacy() {
      if (disposed || !containerRef.current) return;
      const container = containerRef.current;
      container.innerHTML = "";

      if (worldMarbleUrl && selectedUrl === worldMarbleUrl) {
        container.innerHTML = `<iframe src="${worldMarbleUrl}" class="h-full w-full border-0" allow="fullscreen" title="3D world" />`;
        setLoading(false);
        return;
      }

      try {
        const { Viewer } = await import("@mkkellogg/gaussian-splats-3d");
        if (disposed || !containerRef.current) return;

        const viewer = new Viewer({
          rootElement: container,
          cameraUp: [0, 1, 0],
          initialCameraPosition: [0, 1, 3],
          initialCameraLookAt: [0, 0, 0],
          sharedMemoryForWorkers: false,
        });
        await viewer.addSplatScene(selectedUrl!);
        setLoading(false);
        setLoadProgress(100);
        void colliderMeshUrl;

        cleanup = () => {
          viewer.dispose?.();
          container.innerHTML = "";
        };
      } catch (err) {
        if (viewerUrl) {
          setUseIframe(true);
          setLoading(false);
        } else {
          setLoadError(err instanceof Error ? err.message : "Failed to load 3D world");
          setLoading(false);
        }
      }
    }

    (useSpark ? initSpark() : initLegacy()).catch((err) => {
      if (viewerUrl) {
        setUseIframe(true);
        setLoading(false);
      } else {
        setLoadError(err instanceof Error ? err.message : "Failed to load 3D world");
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      cleanup?.();
    };
  }, [spz100kUrl, spz500kUrl, spzFullResUrl, worldMarbleUrl, colliderMeshUrl, viewerUrl, splatFormat, onPositionChange]);

  if (useIframe && viewerUrl) {
    return (
      <div className="relative h-full w-full">
        <iframe src={viewerUrl} className="h-full w-full border-0" allow="fullscreen" title="Immersive 3D world" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full bg-black" />
      {loading && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-white/80">Loading 3D world… {loadProgress > 0 ? `${loadProgress}%` : ""}</p>
          <p className="max-w-xs text-center text-xs text-white/50">Large worlds may take 30–60 seconds on first load.</p>
        </div>
      )}
      {loadError && (
        <p className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center text-sm text-white/70">
          {loadError}
        </p>
      )}
      {!loading && !loadError && (
        <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white/70">
          Drag to look · Scroll to zoom · Right-drag to pan
        </p>
      )}
    </div>
  );
}
