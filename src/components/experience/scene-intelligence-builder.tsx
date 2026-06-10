"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MediaUpload } from "@/components/shared/media-upload";
import { SceneEditorPanel } from "@/components/experience/scene-editor-panel";
import { SceneMotionPicker } from "@/components/experience/scene-motion-picker";
import { FlatAnnotationEditor } from "@/components/experience/flat-annotation-editor";
import type { MotionType, PropertyScene, SceneAnnotationRecord } from "@/types/scene-intelligence";
import { Film, MapPin, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";

type BuilderTab = "scenes" | "edit" | "motion" | "annotate";

export function SceneIntelligenceBuilder({ experienceId, propertyId }: { experienceId: string; propertyId: string }) {
  const [scenes, setScenes] = useState<PropertyScene[]>([]);
  const [selected, setSelected] = useState<PropertyScene | null>(null);
  const [sceneTitle, setSceneTitle] = useState("");
  const [tab, setTab] = useState<BuilderTab>("scenes");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/property-scenes?experienceId=${experienceId}`)
      .then((r) => r.json())
      .then((data: PropertyScene[]) => setScenes(data))
      .catch(() => {});
  }, [experienceId]);

  async function addScene(fileUrl: string) {
    const res = await fetch("/api/property-scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experience_id: experienceId,
        property_id: propertyId,
        title: sceneTitle || `Scene ${scenes.length + 1}`,
        image_url: fileUrl,
        thumbnail_url: fileUrl,
        is_start_scene: scenes.length === 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    const scene = { ...data, scene_annotations: [] as SceneAnnotationRecord[] };
    setScenes((s) => [...s, scene]);
    setSelected(scene);
    setSceneTitle("");
    setTab("edit");
    toast.success("Scene added — edit image and choose motion");
  }

  async function saveScene(patch: Partial<PropertyScene>) {
    if (!selected) return;
    const merged = { ...selected, ...patch };
    setSelected(merged);
    setScenes((s) => s.map((sc) => (sc.id === selected.id ? merged : sc)));
  }

  async function persistScene(patch: Partial<PropertyScene> = {}) {
    if (!selected) return;
    setSaving(true);
    const body = { ...selected, ...patch };
    const res = await fetch(`/api/property-scenes/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Failed to save scene");
    const data = await res.json();
    const updated = { ...data, scene_annotations: selected.scene_annotations ?? [] };
    setSelected(updated);
    setScenes((s) => s.map((sc) => (sc.id === selected.id ? updated : sc)));
    toast.success("Scene saved");
  }

  async function setMotion(motionType: MotionType) {
    if (!selected) return;
    await persistScene({ motion_type: motionType });
  }

  async function setStartScene(id: string) {
    await fetch(`/api/property-scenes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_start_scene: true }) });
    setScenes((s) => s.map((sc) => ({ ...sc, is_start_scene: sc.id === id })));
    toast.success("Start scene updated");
  }

  async function publish() {
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`Published: ${data.publishedUrl}`);
  }

  const tabs: { id: BuilderTab; label: string; icon: typeof Film }[] = [
    { id: "scenes", label: "Scenes", icon: Film },
    { id: "edit", label: "Edit", icon: Pencil },
    { id: "motion", label: "Motion", icon: Sparkles },
    { id: "annotate", label: "Pins", icon: MapPin },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium sm:flex-none sm:px-4 ${tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,260px)_1fr]">
        <Card className={tab === "scenes" ? "block" : "hidden xl:block"}>
          <CardHeader>
            <CardTitle className="text-base">Property Scenes</CardTitle>
            <p className="text-xs text-muted-foreground">Upload 1–35 images. Each becomes a cinematic scene.</p>
            <Input placeholder="Scene title (e.g. Kitchen)" value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} className="mb-2" />
            <MediaUpload propertyId={propertyId} onUploaded={(a) => addScene(a.file_url)} />
          </CardHeader>
          <CardContent className="space-y-2">
            {scenes.map((scene, i) => (
              <div key={scene.id} className={`rounded-md border p-2 ${selected?.id === scene.id ? "border-primary bg-primary/5" : ""}`}>
                <button type="button" onClick={() => { setSelected(scene); setTab("edit"); }} className="w-full text-left text-sm">
                  <span className="font-medium">{i + 1}. {scene.title}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({scene.scene_annotations?.length ?? 0} pins)
                  </span>
                </button>
                <div className="mt-1 flex flex-wrap gap-1">
                  {scene.is_start_scene && <Badge variant="secondary">Start</Badge>}
                  <Badge variant="outline" className="text-[10px]">{scene.motion_type?.replace(/_/g, " ")}</Badge>
                  {!scene.is_start_scene && (
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setStartScene(scene.id)}>Set start</Button>
                  )}
                </div>
              </div>
            ))}
            {!scenes.length && <p className="text-sm text-muted-foreground">Upload your first property image to begin.</p>}
          </CardContent>
        </Card>

        <div>
          {!selected ? (
            <Card>
              <CardContent className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
                Upload or select a scene to edit, add motion, and pin objects
              </CardContent>
            </Card>
          ) : tab === "edit" ? (
            <SceneEditorPanel
              scene={selected}
              propertyId={propertyId}
              onChange={saveScene}
              onSave={() => persistScene()}
              saving={saving}
            />
          ) : tab === "motion" ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Choose scene motion</CardTitle>
                <p className="text-sm text-muted-foreground">Cinematic micro-motion for {selected.title}</p>
              </CardHeader>
              <CardContent>
                <SceneMotionPicker scene={selected} onSelect={setMotion} saving={saving} />
              </CardContent>
            </Card>
          ) : tab === "annotate" ? (
            <FlatAnnotationEditor
              scene={selected}
              annotations={(selected.scene_annotations ?? []) as SceneAnnotationRecord[]}
              onAnnotationsChange={(next) => {
                const updated = { ...selected, scene_annotations: next };
                setSelected(updated);
                setScenes((s) => s.map((sc) => (sc.id === selected.id ? updated : sc)));
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select a scene from the list to edit, motion, or annotate
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <a href={`/view/${experienceId}?preview=1`} target="_blank" rel="noreferrer">Preview viewer</a>
        </Button>
        <Button onClick={publish} disabled={!scenes.length}>Publish cinematic viewer</Button>
      </div>
    </div>
  );
}
