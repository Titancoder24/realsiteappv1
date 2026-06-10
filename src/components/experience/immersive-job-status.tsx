"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { subscribeWorldLabsJob } from "@/lib/supabase/realtime";
import type { WorldLabsJobStatus as JobStatus } from "@/types/domain";

const PROGRESS_MAP: Partial<Record<JobStatus, number>> = {
  worldlabs_generation_requested: 15,
  worldlabs_processing: 55,
  worldlabs_succeeded: 85,
  ready_for_review: 100,
  published: 100,
};

export function ImmersiveJobStatus({ jobId, onReady }: { jobId: string; onReady?: () => void }) {
  const [status, setStatus] = useState("worldlabs_processing");
  const [developerLabel, setDeveloperLabel] = useState("Building immersive world");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function poll() {
      const res = await fetch(`/api/immersive/jobs/${jobId}`);
      const data = await res.json();
      if (data.status) applyUpdate(data.status, data.developerLabel, data.errorMessage);
    }

    function applyUpdate(s: string, label?: string, err?: string) {
      setStatus(s);
      setDeveloperLabel(label ?? "Processing");
      if (err) setErrorMessage(err);
      if (s === "ready_for_review" || s === "published") onReady?.();
    }

    poll();
    const unsubRealtime = subscribeWorldLabsJob(jobId, (row) => {
      applyUpdate(row.status as string);
    });
    const interval = setInterval(poll, 12000);
    return () => { clearInterval(interval); unsubRealtime(); };
  }, [jobId, onReady]);

  const progress = PROGRESS_MAP[status as JobStatus] ?? 40;
  const failed = status.includes("failed");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{developerLabel}</CardTitle>
        <Badge variant={failed ? "destructive" : progress >= 100 ? "success" : "secondary"}>
          {failed ? "Failed" : progress >= 100 ? "Complete" : "Processing"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progress} />
        {failed && errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {failed
            ? "Generation failed. Go back and try again with a different photo."
            : "Echo generation typically takes 6–8 minutes. Keep this page open or return later."}
        </p>
      </CardContent>
    </Card>
  );
}
