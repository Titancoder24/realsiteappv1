"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ScrollWalkthroughShell } from "@/components/buyer/scroll-walkthrough-shell";
import { WalkthroughBuyerChat } from "@/components/walkthrough/walkthrough-buyer-chat";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WalkthroughAnnotation, WalkthroughScene } from "@/types/cinematic-walkthrough";
import { X } from "lucide-react";
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
  const [aiCommand, setAiCommand] = useState<WalkthroughAICommand | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | undefined>();
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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!data) {
    return <div className="flex h-[100dvh] items-center justify-center bg-black text-white">Walkthrough not found</div>;
  }

  const scenes = (data.walkthrough_scenes ?? []).sort((a, b) => a.scene_order - b.scene_order);
  const branding = data.properties?.projects?.branding;

  return (
    <div className="relative h-[100dvh] w-full bg-black">
      <ScrollWalkthroughShell
        scenes={scenes}
        projectName={data.properties?.projects?.name ?? "Project"}
        propertyName={data.properties?.name ?? "Property"}
        brandColor={branding?.primary_color}
        logoUrl={branding?.logo_url}
        onSceneEvent={(type, payload) => {
          if (payload?.sceneId) setActiveSceneId(String(payload.sceneId));
          track(type, payload);
        }}
        externalAICommand={aiCommand}
        onAICommand={(cmd) => {
          track("ai_navigation_command", { command: cmd.command });
          if (cmd.command === "OPEN_LEAD_FORM") setShowLead(true);
        }}
        onAnnotationClick={(ann) => {
          setActiveAnn(ann);
          if (ann.cta_label) track("annotation_cta_clicked", { annotationId: ann.id, title: ann.title });
        }}
        onAskAI={() => { setShowAI(true); track("ai_question_asked", {}); }}
        onContact={() => { setShowLead(true); track("lead_form_opened", {}); }}
      />

      {showAI && sessionId && (
        <div className="wt-sheet">
          <div className="wt-sheet-handle" />
          <div className="wt-sheet-header">
            <span className="font-semibold">Ask about this property</span>
            <button type="button" className="rounded-full p-2" onClick={() => setShowAI(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="wt-sheet-body h-[60vh]">
            <WalkthroughBuyerChat
              organizationId={data.organization_id}
              propertyId={data.property_id}
              experienceId={data.id}
              sessionId={sessionId}
              activeSceneId={activeSceneId}
              onCommand={(cmd) => {
                setAiCommand(cmd);
                setTimeout(() => setAiCommand(null), 100);
              }}
              onClose={() => setShowAI(false)}
            />
          </div>
        </div>
      )}

      {activeAnn && (
        <div className="wt-sheet">
          <div className="wt-sheet-handle" />
          <div className="wt-sheet-header">
            <span className="font-semibold">{activeAnn.title}</span>
            <button type="button" className="rounded-full p-2" onClick={() => setActiveAnn(null)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="wt-sheet-body p-4">
            <p className="text-sm text-muted-foreground">{activeAnn.description ?? activeAnn.short_description}</p>
            {activeAnn.cta_label && (
              <Button className="mt-4 w-full min-h-[44px]" onClick={() => track("annotation_cta_clicked", { annotationId: activeAnn.id })}>
                {activeAnn.cta_label}
              </Button>
            )}
          </div>
        </div>
      )}

      {showLead && (
        <div className="wt-sheet">
          <div className="wt-sheet-handle" />
          <div className="wt-sheet-header">
            <span className="font-semibold">Contact sales</span>
            <button type="button" className="rounded-full p-2" onClick={() => setShowLead(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="wt-sheet-body space-y-4 p-4">
            <div>
              <Label>Name</Label>
              <Input className="mt-1 min-h-[44px] text-base" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input className="mt-1 min-h-[44px] text-base" type="tel" inputMode="tel" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
            </div>
            <Button
              className="w-full min-h-[48px]"
              onClick={async () => {
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
              }}
            >
              Submit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WalkthroughPublicPage() {
  return (
    <Suspense fallback={<div className="flex h-[100dvh] items-center justify-center bg-black text-white">Loading walkthrough…</div>}>
      <WalkthroughViewerContent />
    </Suspense>
  );
}
