"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ScrollWalkthroughShell } from "@/components/buyer/scroll-walkthrough-shell";
import { AIVoicePanel } from "@/components/buyer/ai-voice-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import { MessageSquare, Phone } from "lucide-react";
import "@/styles/walkthrough-studio.css";

interface WalkthroughData {
  id: string;
  type: string;
  slug: string;
  organization_id: string;
  property_id: string;
  properties?: { name: string; projects?: { name: string; branding?: { primary_color?: string; logo_url?: string } } };
  walkthrough_scenes?: WalkthroughScene[];
}

function WalkthroughViewerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const preview = searchParams.get("preview") === "1";
  const [data, setData] = useState<WalkthroughData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [activeAnn, setActiveAnn] = useState<WalkthroughAnnotation | null>(null);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "" });

  const track = useCallback(async (eventType: string, payload?: Record<string, unknown>) => {
    if (!sessionId || !data) return;
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        propertyId: data.property_id,
        organizationId: data.organization_id,
        experienceId: data.id,
        eventType,
        payload: { ...payload, experienceType: "cinematic_walkthrough" },
      }),
    });
    await fetch("/api/walkthrough/viewer-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        experienceId: data.id,
        propertyId: data.property_id,
        organizationId: data.organization_id,
        eventType,
        sceneId: payload?.sceneId,
        annotationId: payload?.annotationId,
        payload,
      }),
    }).catch(() => {});
  }, [sessionId, data]);

  useEffect(() => {
    fetch(`/api/experiences/public/${slug}${preview ? "?preview=1" : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Walkthrough not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setData(null));
  }, [slug, preview]);

  useEffect(() => {
    if (!data) return;
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: data.property_id,
        organizationId: data.organization_id,
        experienceId: data.id,
      }),
    })
      .then((r) => r.json())
      .then((s) => setSessionId(s.id))
      .catch(() => {});
  }, [data]);

  if (!data) {
    return <div className="flex h-screen items-center justify-center bg-black text-white">Walkthrough not found</div>;
  }

  const scenes = (data.walkthrough_scenes ?? []).sort((a, b) => a.scene_order - b.scene_order);
  const branding = data.properties?.projects?.branding;

  return (
    <div className="relative h-screen bg-black">
      <ScrollWalkthroughShell
        scenes={scenes}
        projectName={data.properties?.projects?.name ?? "Project"}
        propertyName={data.properties?.name ?? "Property"}
        brandColor={branding?.primary_color}
        logoUrl={branding?.logo_url}
        onSceneEvent={track}
        onAnnotationClick={(ann) => {
          setActiveAnn(ann);
          if (ann.cta_label) track("annotation_cta_clicked", { annotationId: ann.id, title: ann.title });
        }}
        onAskAI={() => { setShowAI(true); track("ai_question_asked", {}); }}
      />

      <div className="absolute right-4 top-20 z-50 flex flex-col gap-2">
        <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setShowAI(true)}>
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" className="rounded-full" onClick={() => { setShowLead(true); track("lead_form_opened", {}); }}>
          <Phone className="h-4 w-4" />
        </Button>
      </div>

      {showAI && sessionId && (
        <div className="absolute bottom-0 left-0 right-0 z-50 max-h-[50vh] border-t bg-background">
          <AIVoicePanel
            propertyId={data.property_id}
            organizationId={data.organization_id}
            sessionId={sessionId}
            onClose={() => setShowAI(false)}
          />
        </div>
      )}

      {activeAnn && (
        <div className="absolute bottom-0 left-0 right-0 z-50 border-t bg-background p-4">
          <h3 className="font-semibold">{activeAnn.title}</h3>
          <p className="text-sm text-muted-foreground">{activeAnn.description ?? activeAnn.short_description}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setActiveAnn(null)}>Close</Button>
        </div>
      )}

      <Dialog open={showLead} onOpenChange={setShowLead}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contact sales</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  property_id: data.property_id,
                  organization_id: data.organization_id,
                  session_id: sessionId,
                  name: leadForm.name,
                  phone: leadForm.phone,
                  source: "cinematic_walkthrough",
                }),
              });
              track("lead_submitted", leadForm);
              setShowLead(false);
            }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WalkthroughPublicPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading walkthrough…</div>}>
      <WalkthroughViewerContent />
    </Suspense>
  );
}
