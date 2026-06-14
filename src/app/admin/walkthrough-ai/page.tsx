"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Cloud, Router, Sparkles } from "lucide-react";

interface WalkthroughAIConfig {
  provider: "openrouter" | "vertex";
  openrouter: { configured: boolean; planner: string; video: string };
  vertex: {
    configured: boolean;
    planner_model: string;
    video_model: string;
    location: string;
    project_id: string;
    api_key_set: boolean;
    api_key_preview: string;
  };
}

export default function WalkthroughAIAdminPage() {
  const [config, setConfig] = useState<WalkthroughAIConfig | null>(null);
  const [vertexKey, setVertexKey] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/admin/walkthrough-ai").then((r) => r.json()).then((d) => {
      setConfig(d);
      setProjectId(d.vertex?.project_id ?? "");
    });
  }

  useEffect(() => { load(); }, []);

  async function setProvider(provider: "openrouter" | "vertex") {
    setSaving(true);
    const res = await fetch("/api/admin/walkthrough-ai", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        vertex_api_key: vertexKey || undefined,
        vertex_project_id: projectId || undefined,
        reason: `Switched walkthrough AI to ${provider}`,
      }),
    });
    setSaving(false);
    if (!res.ok) return toast.error("Failed to update provider");
    toast.success(`Walkthrough AI provider set to ${provider === "vertex" ? "Google Vertex AI" : "OpenRouter"}`);
    setVertexKey("");
    load();
  }

  if (!config) return <div className="p-6">Loading…</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <div>
            <h1 className="text-2xl font-semibold">Property Walkthrough AI</h1>
            <p className="text-sm text-muted-foreground">Super Admin · Choose OpenRouter or Google Vertex AI (Gemini 3.5 Flash + Veo 3.1 Lite)</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active provider</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant={config.provider === "openrouter" ? "default" : "outline"}
                disabled={saving}
                onClick={() => setProvider("openrouter")}
                className="gap-2"
              >
                <Router className="h-4 w-4" /> OpenRouter
                {config.provider === "openrouter" && <Badge variant="secondary">Active</Badge>}
              </Button>
              <Button
                variant={config.provider === "vertex" ? "default" : "outline"}
                disabled={saving}
                onClick={() => setProvider("vertex")}
                className="gap-2"
              >
                <Cloud className="h-4 w-4" /> Google Vertex AI
                {config.provider === "vertex" && <Badge variant="secondary">Active</Badge>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Planner: {config.provider === "vertex" ? config.vertex.planner_model : config.openrouter.planner} ·
              Video: {config.provider === "vertex" ? config.vertex.video_model : config.openrouter.video}
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Router className="h-4 w-4" /> OpenRouter</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{config.openrouter.configured ? "Configured (env)" : "Missing API key"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Planner</span><span className="font-mono text-xs">{config.openrouter.planner}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Video</span><span className="font-mono text-xs">{config.openrouter.video}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cloud className="h-4 w-4" /> Google Vertex AI</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{config.vertex.configured ? `Key: ${config.vertex.api_key_preview}` : "Not configured"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Gemini planner</span><span className="font-mono text-xs">{config.vertex.planner_model}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Veo video</span><span className="font-mono text-xs">{config.vertex.video_model}</span></div>
              <div>
                <label className="text-xs font-medium">Vertex API key</label>
                <Input
                  type="password"
                  placeholder="AQ.xxx… (Google Cloud / Vertex Express)"
                  value={vertexKey}
                  onChange={(e) => setVertexKey(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Project ID (optional for Express mode)</label>
                <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="your-gcp-project" className="mt-1" />
              </div>
              <Button size="sm" variant="outline" disabled={saving || !vertexKey} onClick={() => setProvider("vertex")}>
                Save Vertex key & activate
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Pipeline coverage</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>· <strong>Analyze & plan scenes</strong> — Gemini 3.5 Flash (vision) via selected provider</p>
            <p>· <strong>Generate motion</strong> — Veo 3.1 Lite via selected provider</p>
            <p>· <strong>Fallback</strong> — If AI fails (credits, timeout), scenes are still created from uploaded images</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
