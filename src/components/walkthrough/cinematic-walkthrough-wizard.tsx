"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalkthroughRagChat } from "@/components/walkthrough/walkthrough-rag-chat";
import type { WalkthroughChecklist, WalkthroughImage, WalkthroughScene, WalkthroughWizardStep } from "@/types/cinematic-walkthrough";
import { WALKTHROUGH_MOTION_PRESETS, WALKTHROUGH_WIZARD_STEPS } from "@/types/cinematic-walkthrough";
import { Check, ExternalLink, GripVertical, Loader2, Sparkles, Upload } from "lucide-react";
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

  const load = useCallback(async () => {
    const [imgRes, sceneRes, checkRes] = await Promise.all([
      fetch(`/api/walkthrough/images?experienceId=${experienceId}`),
      fetch(`/api/walkthrough/scenes?experienceId=${experienceId}`),
      fetch(`/api/walkthrough/checklist/${experienceId}`),
    ]);
    const [imgData, sceneData, checkData] = await Promise.all([
      imgRes.json(),
      sceneRes.json(),
      checkRes.json(),
    ]);
    if (Array.isArray(imgData)) setImages(imgData);
    if (Array.isArray(sceneData)) setScenes(sceneData);
    if (checkData.experience_id) setChecklist(checkData);
  }, [experienceId]);

  useEffect(() => {
    load().catch(() => toast.error("Failed to load walkthrough"));
  }, [load]);

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
    setPlanning(true);
    const res = await fetch("/api/walkthrough/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experience_id: experienceId }),
    });
    const data = await res.json();
    setPlanning(false);
    if (!res.ok) return toast.error(data.error ?? "Scene planning failed");
    if (data.flow_warnings?.length) {
      data.flow_warnings.forEach((w: string) => toast.warning(w));
    }
    toast.success(`Created ${data.scenes?.length ?? 0} scenes`);
    await load();
    setStep("arrange");
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
    await fetch(`/api/walkthrough/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motion_type: motionType }),
    });
    await load();
  }

  async function publish() {
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`Published: ${data.publishedUrl}`);
    await load();
  }

  const stepIndex = WALKTHROUGH_WIZARD_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="wt-studio">
      <header className="wt-header">
        <div>
          <h1 className="text-lg font-semibold">Property Walkthrough</h1>
          <p className="text-sm text-muted-foreground">360° Capture · Upload normal images → AI plan → Veo motion → annotations → publish</p>
        </div>
        <div className="wt-btn-stack sm:flex-row">
          {slug && (
            <Button variant="outline" size="sm" className="min-h-[44px]" asChild>
              <a href={`/walkthrough/${slug}?preview=1`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" /> Preview
              </a>
            </Button>
          )}
          <Button size="sm" className="min-h-[44px]" onClick={publish}>Publish</Button>
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
              <h2 className="font-medium">Add property images</h2>
              <p className="mt-1 text-sm text-muted-foreground">Upload 1–35 photos — phone, DSLR, brochure, drone, any listing images you own.</p>
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
            <Button onClick={() => setStep("scenes")}>Continue to create scenes</Button>
          </div>
        )}

        {step === "scenes" && (
          <div className="space-y-4">
            <div className="wt-card">
              <h2 className="font-medium">Create scenes</h2>
              <p className="text-sm text-muted-foreground">AI names each room, suggests motion, and builds your walkthrough flow.</p>
              <Button className="mt-4" onClick={planScenes} disabled={planning}>
                {planning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate scenes with AI
              </Button>
            </div>
            {scenes.length > 0 && (
              <div className="space-y-2">
                {scenes.map((s) => (
                  <div key={s.id} className="wt-card flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.thumbnail_url ?? s.image_url} alt="" className="h-14 w-20 rounded object-cover" />
                    <div className="flex-1">
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.room_type} · {s.motion_type}</p>
                    </div>
                  </div>
                ))}
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
                <h2 className="font-medium">Generate motion assets</h2>
                <p className="text-sm text-muted-foreground">Veo 3.1 Lite creates short motion clips per scene. CSS fallback used until ready.</p>
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
                  setGeneratingMotion(false);
                  if (!res.ok) return toast.error(data.error ?? "Motion generation failed");
                  toast.success(`Motion generated ${data.completed}/${data.total} scenes`);
                  const jobsRes = await fetch(`/api/walkthrough/video/jobs?experienceId=${experienceId}`);
                  setVideoJobs(await jobsRes.json());
                  await load();
                }}
              >
                {generatingMotion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate all motion
              </Button>
            </div>
            {scenes.map((s) => (
              <div key={s.id} className="wt-card">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium">{s.title}</p>
                  <span className="text-xs text-muted-foreground">{s.video_url ? "Motion ready" : s.scene_status ?? "fallback image"}</span>
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
            ))}
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
            <p className="text-sm text-muted-foreground">AI suggested pins were added during scene creation. Add more from the scene list or edit in preview.</p>
            {scenes.map((s) => (
              <div key={s.id} className="wt-card">
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{(s.walkthrough_annotations ?? []).length} pins</p>
                {(s.walkthrough_annotations ?? []).map((a) => (
                  <span key={a.id} className="mr-2 mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs">{a.title}</span>
                ))}
              </div>
            ))}
            <Button onClick={() => setStep("rag")}>Add property details</Button>
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
              <h2 className="font-medium">Preview</h2>
              <p className="text-sm text-muted-foreground">Scroll through the cinematic walkthrough as buyers will see it.</p>
              {slug && (
                <Button className="mt-4" asChild>
                  <a href={`/walkthrough/${slug}?preview=1`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open preview
                  </a>
                </Button>
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
                  ["property_rag_added", "Property RAG added"],
                ].map(([key, label]) => (
                  <div key={key} className="wt-check-item" data-done={checklist[key as keyof WalkthroughChecklist] ? "true" : "false"}>
                    <Check className="h-4 w-4" /> {label}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => setStep("publish")}>Ready to publish</Button>
          </div>
        )}

        {step === "publish" && (
          <div className="wt-card space-y-4 text-center">
            <h2 className="text-xl font-semibold">Publish walkthrough</h2>
            <p className="text-muted-foreground">Share link: /walkthrough/{slug ?? "your-slug"}</p>
            <Button size="lg" onClick={publish}>Publish now</Button>
          </div>
        )}
      </div>
    </div>
  );
}
