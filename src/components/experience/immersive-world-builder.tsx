"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ImmersiveJobStatus } from "./immersive-job-status";
import { MediaUpload } from "@/components/shared/media-upload";
import { toast } from "sonner";

const STEPS = ["Upload Photo", "Add Notes", "Generate", "Annotate", "Publish"];

export function ImmersiveWorldBuilder({ experienceId, propertyId }: { experienceId: string; propertyId: string }) {
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mediaAssetIds, setMediaAssetIds] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function submitGeneration() {
    if (!mediaAssetIds.length && !notes.trim()) {
      return toast.error("Upload a property photo or describe the scene");
    }
    setUploading(true);
    try {
      const res = await fetch("/api/immersive/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experienceId, propertyId, prompt: notes.trim() || undefined, mediaAssetIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setJobId(data.jobId);
      setStep(2);
      toast.success("Immersive world generation started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setUploading(false);
    }
  }

  async function publish() {
    const res = await fetch(`/api/experiences/${experienceId}/publish`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`Published: ${data.publishedUrl}`);
    setStep(4);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Immersive World</h2>
        <p className="text-muted-foreground">
          Turn a property photo into an explorable 3D environment buyers can walk through.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <Badge key={s} variant={i <= step ? "default" : "outline"}>{s}</Badge>
        ))}
      </div>
      <Progress value={((step + 1) / STEPS.length) * 100} />

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Property Photo</CardTitle>
            <CardDescription>Upload a clear exterior or interior shot — wide angle works best.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Uploaded property" className="max-h-48 rounded-lg border object-cover" />
            )}
            <MediaUpload
              propertyId={propertyId}
              onUploaded={(a) => {
                setMediaAssetIds([a.id]);
                setPreviewUrl(a.file_url);
              }}
            />
            <Button onClick={() => setStep(1)} disabled={!mediaAssetIds.length && !notes.trim()}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Scene Notes</CardTitle>
            <CardDescription>Optional context — room type, lighting, or features to emphasize.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="e.g. Sunlit living room with floor-to-ceiling windows and hardwood floors"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={submitGeneration} disabled={uploading}>
                {uploading ? "Starting…" : "Generate Immersive World"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step >= 2 && jobId && <ImmersiveJobStatus jobId={jobId} onReady={() => setStep(3)} />}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Annotate &amp; Review</CardTitle>
            <CardDescription>Add floor maps and checkpoints before publishing to buyers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline">
              <a href={`/dashboard/floor-maps?propertyId=${propertyId}&experienceId=${experienceId}`}>Add Floor Map</a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/dashboard/checkpoints?propertyId=${propertyId}&experienceId=${experienceId}`}>Add Checkpoints</a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/tour/${experienceId}?preview=1`} target="_blank" rel="noreferrer">Preview 3D Viewer</a>
            </Button>
            <Button onClick={publish}>Publish Experience</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
