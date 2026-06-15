"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalkthroughRagChat } from "@/components/walkthrough/walkthrough-rag-chat";
import { WalkthroughAnnotationEditor } from "@/components/walkthrough/walkthrough-annotation-editor";
import type { WalkthroughChecklist, WalkthroughImage, WalkthroughScene, WalkthroughWizardStep } from "@/types/cinematic-walkthrough";
import { WALKTHROUGH_MOTION_PRESETS, WALKTHROUGH_WIZARD_STEPS } from "@/types/cinematic-walkthrough";
import type { WalkthroughMotionType } from "@/types/cinematic-walkthrough";
import { veoPromptForMotion } from "@/lib/veo-motion-prompts";
import { Check, Clapperboard, ExternalLink, GripVertical, Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import "@/styles/walkthrough-studio.css";

export function CinematicWalkthroughWizard({
  experienceId,
  propertyId,
  slug,
}: {
  experienceId: string;
  propertyId: string;
  slug?: string;
}) {
  const [step, setStep] = useState<WalkthroughWizardStep>("upload");
  const [images, setImages] = useState<WalkthroughImage[]>([]);
  const [scenes, setScenes] = useState<WalkthroughScene[]>([]);
  const [checklist, setChecklist] = useState<WalkthroughChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [generatingMotion, setGeneratingMotion] = useState(false);
  const [videoJobs, setVideoJobs] = useState<{ status: string; scene_id: string }[]>([]);
  const [activePinSceneId, setActivePinSceneId] = useState<string | null>(null);
  const [aiTestReply, setAiTestReply] = useState<string | null>(null);
  const [aiTestCommand, setAiTestCommand] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canPublish = Boolean(
    checklist?.images_uploaded &&
    checklist?.scenes_created &&
    checklist?.property_rag_added &&
    checklist?.motion_videos_generated,
  );

  const motionReadyCount = scenes.filter((s) => s.video_url).length;

  const load = useCallback(async () => {
    const [imgRes, sceneRes, checkRes, jobsRes] = await Promise.all([
      fetch(`/api/walkthrough/images?experienceId=${experienceId}`),
      fetch(`/api/walkthrough/scenes?experienceId=${experienceId}`),
      fetch(`/api/walkthrough/checklist/${experienceId}`),
      fetch(`/api/walkthrough/video/jobs?experienceId=${experienceId}`),
    ]);

    if (!imgRes.ok) {
      const err = await imgRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to load images");
    }
    if (!sceneRes.ok) {
      const err = await sceneRes.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to load scenes");
    }

    const [imgData, sceneData, checkData, jobsData] = await Promise.all([
      imgRes.json(),
      sceneRes.json(),
      checkRes.json(),
      jobsRes.ok ? jobsRes.json() : [],
    ]);

    if (Array.isArray(imgData)) setImages(imgData);
    if (Array.isArray(sceneData)) {
      setScenes(sceneData);
      setActivePinSceneId((prev) => prev ?? sceneData[0]?.id ?? null);
    }
    if (checkData.experience_id) setChecklist(checkData);
    if (Array.isArray(jobsData)) setVideoJobs(jobsData);
  }, [experienceId]);

  useEffect(() => {
    load().catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load walkthrough"));
  }, [load]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function prepareImagesForPlanning() {
    const pending = images.filter((img) => img.enhancement_status === "pending" || img.enhancement_status === "processing");
    for (const img of pending) {
      await fetch(`/api/walkthrough/images/${img.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enhancement_status: "skipped" }),
      });
    }
    if (pending.length) await load();
  }

  async function pollVideoJobs() {
    const res = await fetch("/api/walkthrough/video/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience_id: experienceId }),
    });
    const data = await res.json();
    if (!res.ok) return;
    await load();
    if (data.processing === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      setGeneratingMotion(false);
      if (data.completed > 0) toast.success(`Motion ready for ${data.completed} scene${data.completed === 1 ? "" : "s"}`);
      if (data.failed > 0) toast.warning(`${data.failed} Veo job${data.failed === 1 ? "" : "s"} failed — regenerate motion before publishing`);
    }
  }

  function startVideoPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      pollVideoJobs().catch(() => {});
    }, 4000);
    pollVideoJobs().catch(() => {});
  }

  useEffect(() => {
    const pending = videoJobs.some((j) => ["queued", "submitted", "processing"].includes(j.status));
    if (pending && !pollRef.current) {
      setGeneratingMotion(true);
      startVideoPolling();
    }
  }, [videoJobs]);

  async function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setLoading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("experienceId", experienceId);
      form.append("propertyId", propertyId);
      const res = await fetch("/api/walkthrough/images", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? `Failed: ${file.name}`);
        break;
      }
      setImages((i) => [...i, data]);
    }
    setLoading(false);
    toast.success("Images uploaded");
    await load();
  }

  async function enhanceAll() {
    setEnhancing(true);
    const res = await fetch("/api/walkthrough/enhance-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience_id: experienceId }),
    });
    const data = await res.json();
    setEnhancing(false);
    if (!res.ok) return toast.error(data.error ?? "Enhancement failed");
    toast.success(`Enhanced ${data.enhanced} images`);
    await load();
    setStep("scenes");
  }

  async function approveImage(id: string, status: "approved" | "rejected" | "skipped") {
    await fetch(`/api/walkthrough/images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enhancement_status: status, approved_by_user: status === "approved" }),
    });
    await load();
  }

  async function planScenes() {
    if (!images.length) return toast.error("Upload images first");
    setPlanning(true);
    try {
      await prepareImagesForPlanning();
      const res = await fetch("/api/walkthrough/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scene planning failed");
      if (data.flow_warnings?.length) {
        data.flow_warnings.forEach((w: string) => toast.warning(w));
      }
      const count = data.scenes?.length ?? 0;
      if (!count) throw new Error("No scenes were created — check your images and try again");
      toast.success(`Created ${count} scenes — generating Veo motion clips`);
      await load();
      setStep("motion");
      setGeneratingMotion(true);
      const motionRes = await fetch("/api/walkthrough/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience_id: experienceId }),
      });
      const motionData = await motionRes.json();
      if (motionRes.ok) {
        toast.success(`Queued ${motionData.queued ?? 0} Veo video jobs`);
        startVideoPolling();
      } else {
        toast.warning(motionData.error ?? "Scene plan saved — queue motion manually");
        setGeneratingMotion(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scene planning failed");
    } finally {
      setPlanning(false);
    }
  }

  async function reorderScenes(ordered: WalkthroughScene[]) {
    setScenes(ordered);
    await fetch("/api/walkthrough/scenes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience_id: experienceId, scene_ids: ordered.map((s) => s.id) }),
    });
  }

  function moveScene(index: number, dir: -1 | 1) {
    const next = [...scenes];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    reorderScenes(next);
  }

  async function setSceneMotion(sceneId: string, motionType: string) {
    const scene = scenes.find((s) => s.id === sceneId);
    const veoPrompt = scene
      ? veoPromptForMotion(scene.room_type ?? "room", scene.title, motionType as WalkthroughMotionType)
      : undefined;
    await fetch(`/api/walkthrough/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motion_type: motionType, ...(veoPrompt ? { veo_prompt: veoPrompt } : {}) }),
    });
    await load();
  }

  async function publish() {
    if (!canPublish) {
      return toast.error("Complete the readiness checklist before publishing");
    }
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`Published: ${data.publishedUrl}`);
    await load();
  }

  async function markChecklistFlag(flag: "ai_tested" | "viewer_previewed") {
    await fetch(`/api/walkthrough/checklist/${experienceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [flag]: true }),
    });
    await load();
  }

  async function openPreview() {
    try {
      const res = await fetch(`/api/walkthrough/preview/${experienceId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");

      const path = data.previewUrl ?? `/walkthrough/${data.slug ?? experienceId}?preview=1`;
      const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        toast.error("Pop-up blocked — allow pop-ups, or copy this link", {
          description: url,
        });
        return;
      }

      await markChecklistFlag("viewer_previewed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    }
  }

  async function updateSceneVeoPrompt(sceneId: string, veoPrompt: string) {
    await fetch(`/api/walkthrough/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ veo_prompt: veoPrompt }),
    });
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, veo_prompt: veoPrompt } : s)));
  }

  async function regenerateSceneMotion(sceneId: string) {
    setRegeneratingSceneId(sceneId);
    const res = await fetch("/api/walkthrough/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene_id: sceneId, force: true }),
    });
    const data = await res.json();
    setRegeneratingSceneId(null);
    if (!res.ok) return toast.error(data.error ?? "Regenerate failed");
    toast.success("Motion regeneration queued");
    setGeneratingMotion(true);
    startVideoPolling();
    await load();
  }

  const stepIndex = WALKTHROUGH_WIZARD_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="wt-studio">
      <header className="wt-header">
        <div>
          <h1 className="text-lg font-semibold">Property Walkthrough</h1>
          <p className="text-sm text-muted-foreground">Upload listing photos → Gemini plans the tour → Veo 3.1 Lite builds scroll-controlled video motion</p>
        </div>
        <div className="wt-btn-stack sm:flex-row">
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={openPreview}>
            <ExternalLink className="mr-1 h-4 w-4" /> Preview
          </Button>
          <Button size="sm" className="min-h-[44px]" onClick={publish} disabled={!canPublish}>Publish</Button>
        </div>
      </header>

      <nav className="wt-steps">
        {WALKTHROUGH_WIZARD_STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className="wt-step"
            data-active={step === s.id}
            data-done={i < stepIndex}
            onClick={() => setStep(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="wt-body">
        {step === "upload" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Add listing photos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Upload 1–35 property photos (Zillow-style listing images). Gemini 3.5 Flash maps room-by-room transitions; Veo turns each into a motion clip.</p>
              <div className="mt-4">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 hover:bg-zinc-100">
                  <Upload className="mb-2 h-8 w-8 text-zinc-400" />
                  <span className="text-sm font-medium">Drop images or click to upload</span>
                  <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP — up to 35 images</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={loading || images.length >= 35}
                    onChange={(e) => onFilesSelected(e.target.files)}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{images.length} / 35 images</p>
            </div>
            {images.length > 0 && (
              <div className="wt-grid-2">
                {images.map((img) => (
                  <div key={img.id} className="wt-image-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.original_image_url} alt={img.file_name} />
                    <p className="truncate p-2 text-xs text-white/90">{img.file_name}</p>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => setStep("enhance")} disabled={!images.length}>
              Continue to improve quality <Upload className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "enhance" && (
          <div className="space-y-4">
            <div className="wt-card flex items-center justify-between">
              <div>
                <h2 className="font-medium">Improve image quality</h2>
                <p className="text-sm text-muted-foreground">AI upscales lighting and sharpness without changing the property.</p>
              </div>
              <Button onClick={enhanceAll} disabled={enhancing || !images.length}>
                {enhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Enhance all
              </Button>
            </div>
            <div className="wt-grid-2">
              {images.map((img) => (
                <div key={img.id} className="wt-card space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.original_image_url} alt="Before" className="rounded-md aspect-video object-cover" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.enhanced_image_url ?? img.original_image_url} alt="After" className="rounded-md aspect-video object-cover" />
                  </div>
                  <p className="text-xs text-muted-foreground">Status: {img.enhancement_status}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => approveImage(img.id, "approved")}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => approveImage(img.id, "skipped")}>Use original</Button>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await fetch(`/api/walkthrough/images/${img.id}/enhance`, { method: "POST" });
                      await load();
                    }}>Regenerate</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={async () => {
              await prepareImagesForPlanning();
              setStep("scenes");
            }}>Continue to create scenes</Button>
          </div>
        )}

        {step === "scenes" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Analyze & plan scenes</h2>
              <p className="text-sm text-muted-foreground">AI names each room, suggests motion, and builds your walkthrough flow.</p>
              <Button className="mt-4" onClick={planScenes} disabled={planning || !images.length}>
                {planning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {planning ? "Analyzing images…" : "Generate scenes with AI"}
              </Button>
              {!images.length && (
                <p className="mt-2 text-xs text-amber-700">Upload at least one image to continue.</p>
              )}
            </div>
            {scenes.length > 0 && (
              <div className="wt-card space-y-3">
                <h3 className="text-sm font-medium">Scene plan preview</h3>
                <div className="wt-scene-grid">
                  {scenes.map((s) => (
                    <div key={s.id} className="wt-scene-preview-card">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.thumbnail_url ?? s.image_url} alt={s.title} />
                      <div className="wt-scene-preview-meta">
                        <strong>{s.title}</strong>
                        <small>{s.room_type} · {s.motion_type}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={() => setStep("arrange")} disabled={!scenes.length}>Arrange walkthrough</Button>
          </div>
        )}

        {step === "arrange" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Arrange walkthrough</h2>
              <p className="text-sm text-muted-foreground">Drag order — exterior first, then living, kitchen, bedrooms, amenities.</p>
            </div>
            {checklist?.warnings?.map((w) => (
              <p key={w} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{w}</p>
            ))}
            <div className="space-y-2">
              {scenes.length === 0 && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No scenes yet — go back to Analyze & plan scenes and generate your walkthrough.
                </p>
              )}
              {scenes.map((s, i) => (
                <div key={s.id} className="wt-card flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="w-6 text-sm text-muted-foreground">{i + 1}</span>
                  <Input
                    className="flex-1"
                    value={s.title}
                    onChange={(e) => setScenes((prev) => prev.map((sc) => sc.id === s.id ? { ...sc, title: e.target.value } : sc))}
                    onBlur={async (e) => {
                      await fetch(`/api/walkthrough/scenes/${s.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: e.target.value }),
                      });
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={() => moveScene(i, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" onClick={() => moveScene(i, 1)}>↓</Button>
                </div>
              ))}
            </div>
            <Button onClick={() => setStep("motion")}>Confirm motion</Button>
          </div>
        )}

        {step === "motion" && (
          <div className="space-y-4">
            <div className="wt-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium">Generate video motion (Veo 3.1 Lite)</h2>
                <p className="text-sm text-muted-foreground">
                  Each scene becomes a short motion clip. Buyers scroll to scrub through the video walkthrough.
                  {scenes.length > 0 && ` ${motionReadyCount}/${scenes.length} clips ready.`}
                </p>
              </div>
              <Button
                disabled={generatingMotion || !scenes.length}
                onClick={async () => {
                  setGeneratingMotion(true);
                  const res = await fetch("/api/walkthrough/video/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ experience_id: experienceId }),
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    setGeneratingMotion(false);
                    return toast.error(data.error ?? "Motion generation failed");
                  }
                  toast.success(`Queued ${data.queued ?? data.submitted ?? 0} motion jobs — Veo runs in background`);
                  startVideoPolling();
                }}
              >
                {generatingMotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
                {generatingMotion ? "Generating motion…" : "Generate all motion"}
              </Button>
            </div>
            {scenes.map((s) => {
              const job = videoJobs.find((j) => j.scene_id === s.id);
              const status = s.video_url ? "completed" : job?.status ?? s.scene_status ?? "pending";
              return (
              <div key={s.id} className="wt-card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-medium">{s.title}</p>
                  <span className="wt-motion-status" data-status={status}>
                    {s.video_url ? "Motion ready" : status === "processing" ? "Generating…" : status === "failed" ? "Fallback image" : "Queued / fallback"}
                  </span>
                </div>
                {s.video_url && (
                  <video src={s.video_url} className="mb-2 w-full rounded-md" controls muted playsInline />
                )}
                <div className="mb-2">
                  <label className="text-xs font-medium text-muted-foreground">Veo motion prompt</label>
                  <textarea
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-xs"
                    rows={3}
                    value={s.veo_prompt ?? ""}
                    onChange={(e) => setScenes((prev) => prev.map((sc) => sc.id === s.id ? { ...sc, veo_prompt: e.target.value } : sc))}
                    onBlur={(e) => updateSceneVeoPrompt(s.id, e.target.value)}
                    placeholder="Conservative property-safe motion prompt…"
                  />
                </div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={regeneratingSceneId === s.id || generatingMotion}
                    onClick={() => regenerateSceneMotion(s.id)}
                  >
                    {regeneratingSceneId === s.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Regenerate motion
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {WALKTHROUGH_MOTION_PRESETS.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      className={`rounded-md border px-3 py-1.5 text-xs ${s.motion_type === m.type ? "border-blue-500 bg-blue-50 text-blue-700" : ""}`}
                      onClick={() => setSceneMotion(s.id, m.type)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            );})}
            {videoJobs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Jobs: {videoJobs.filter((j) => j.status === "completed").length} completed · {videoJobs.filter((j) => j.status === "failed").length} failed
              </p>
            )}
            <Button onClick={() => setStep("pins")}>Add annotations</Button>
          </div>
        )}

        {step === "pins" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Add annotation layers</h2>
              <p className="text-sm text-muted-foreground">Place pins on each scene. AI suggested pins from planning appear below — click to edit or add more.</p>
            </div>
            {scenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Create scenes first before adding annotations.</p>
            ) : (
              <>
                <div className="wt-scene-tabs">
                  {scenes.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="wt-scene-tab"
                      data-active={activePinSceneId === s.id}
                      onClick={() => setActivePinSceneId(s.id)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
                {activePinSceneId && (() => {
                  const activeScene = scenes.find((s) => s.id === activePinSceneId);
                  if (!activeScene) return null;
                  const anns = activeScene.walkthrough_annotations ?? [];
                  return (
                    <WalkthroughAnnotationEditor
                      scene={activeScene}
                      annotations={anns}
                      onAnnotationsChange={(next) => {
                        setScenes((prev) => prev.map((s) => (
                          s.id === activeScene.id ? { ...s, walkthrough_annotations: next } : s
                        )));
                      }}
                    />
                  );
                })()}
              </>
            )}
            <Button onClick={() => setStep("rag")} disabled={!scenes.length}>Add property knowledge</Button>
          </div>
        )}

        {step === "rag" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Add property details</h2>
              <p className="text-sm text-muted-foreground">Chat-style input — paste brochure text or describe pricing, amenities, possession.</p>
            </div>
            <WalkthroughRagChat experienceId={experienceId} propertyId={propertyId} />
            <Button onClick={() => setStep("preview")}>Preview walkthrough</Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Test scroll-controlled preview</h2>
              <p className="text-sm text-muted-foreground">Open the hosted walkthrough — scroll scrubs each Veo clip room-by-room. Toggle Walk Mode to jump between rooms.</p>
              <Button className="mt-4" onClick={openPreview}>
                <ExternalLink className="mr-2 h-4 w-4" /> Open preview
              </Button>
            </div>
            <div className="wt-card space-y-3">
              <h3 className="text-sm font-medium">Quick AI test</h3>
              <p className="text-xs text-muted-foreground">Ask a buyer-style question — uses your property knowledge and scene context.</p>
              <div className="flex gap-2">
                <Input
                  placeholder="What amenities does this property have?"
                  onKeyDown={async (e) => {
                    if (e.key !== "Enter") return;
                    const query = (e.target as HTMLInputElement).value.trim();
                    if (!query) return;
                    setAiTesting(true);
                    try {
                      const res = await fetch("/api/walkthrough/buyer-chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          organizationId: scenes[0]?.organization_id,
                          propertyId,
                          experienceId,
                          activeSceneId: scenes[0]?.id,
                          query,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error ?? "AI test failed");
                      setAiTestReply(data.answer ?? data.reply ?? "No response");
                      setAiTestCommand(data.command?.command ?? null);
                      await markChecklistFlag("ai_tested");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "AI test failed");
                    } finally {
                      setAiTesting(false);
                    }
                  }}
                />
                {aiTesting && <Loader2 className="h-4 w-4 animate-spin self-center" />}
              </div>
              {aiTestReply && (
                <div className="space-y-1">
                  <p className="rounded-md bg-muted px-3 py-2 text-sm">{aiTestReply}</p>
                  {aiTestCommand && aiTestCommand !== "NONE" && (
                    <p className="text-xs text-muted-foreground">AI command: {aiTestCommand}</p>
                  )}
                </div>
              )}
            </div>
            {checklist && (
              <div className="wt-card wt-checklist">
                <h3 className="mb-2 font-medium">Readiness checklist</h3>
                {[
                  ["images_uploaded", "Images uploaded"],
                  ["images_enhanced", "Images enhanced"],
                  ["scenes_created", "Scenes created"],
                  ["motion_added", "Motion configured"],
                  ["motion_videos_generated", "Veo motion clips ready"],
                  ["annotations_added", "Annotations added"],
                  ["property_rag_added", "Property RAG added (3+ entries)"],
                  ["ai_tested", "AI agent tested"],
                  ["viewer_previewed", "Mobile/desktop preview opened"],
                  ["ready_to_publish", "Ready to publish"],
                ].map(([key, label]) => (
                  <div key={key} className="wt-check-item" data-done={checklist[key as keyof WalkthroughChecklist] ? "true" : "false"}>
                    <Check className="h-4 w-4" /> {label}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => setStep("publish")} disabled={!canPublish}>Ready to publish</Button>
          </div>
        )}

        {step === "publish" && (
          <div className="wt-card space-y-4 text-center">
            <h2 className="text-xl font-semibold">Publish walkthrough</h2>
            <p className="text-muted-foreground">Share link: /walkthrough/{slug ?? "your-slug"}</p>
            {!canPublish && (
              <p className="text-sm text-amber-700">Complete the checklist in Preview before publishing.</p>
            )}
            <Button size="lg" onClick={publish} disabled={!canPublish}>Publish now</Button>
          </div>
        )}
      </div>
    </div>
  );
}
