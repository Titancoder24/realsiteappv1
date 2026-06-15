"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BrochureViewer } from "@/components/brochure/brochure-viewer";
import type { PropertyBrochure } from "@/types/brochure-intelligence";
import { Button } from "@/components/ui/button";

export default function BrochurePublicPage() {
  return (
    <Suspense fallback={<div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-white">Loading brochure…</div>}>
      <BrochurePublicContent />
    </Suspense>
  );
}

function BrochurePublicContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const [brochure, setBrochure] = useState<PropertyBrochure | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch(`/api/brochures/public/${slug}`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then(setBrochure)
      .finally(() => setLoading(false));
  }, [slug]);

  async function startSession() {
    if (!brochure) return;
    setStarting(true);
    setSessionError(null);
    try {
      const res = await fetch("/api/brochures/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brochureId: brochure.id,
          propertyId: brochure.property_id,
          organizationId: brochure.organization_id,
          consentGiven: true,
          utmSource: searchParams.get("utm_source") ?? undefined,
          utmMedium: searchParams.get("utm_medium") ?? undefined,
          utmCampaign: searchParams.get("utm_campaign") ?? undefined,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          referrerSessionId: searchParams.get("ref_session") ?? undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSessionId(data.sessionId);
      } else {
        setSessionError(data.error ?? "Could not start brochure session. Please try again.");
      }
    } catch {
      setSessionError("Network error. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-white">Loading brochure…</div>;
  }

  if (!brochure) {
    return <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 text-white">Brochure not found</div>;
  }

  if (!brochure.tracking_enabled) {
    return <BrochureViewer brochure={brochure} sessionId="00000000-0000-0000-0000-000000000000" />;
  }

  if (!sessionId) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="max-w-md space-y-4 rounded-xl border border-white/10 bg-zinc-900 p-6">
          <h1 className="text-lg font-semibold">{brochure.title}</h1>
          <p className="text-sm text-white/70">{brochure.consent_notice ?? "This brochure uses engagement analytics to help your sales team assist you better."}</p>
          <label className="flex items-start gap-2 text-sm text-white/80">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            I understand engagement analytics may be collected for this brochure view.
          </label>
          {sessionError && <p className="text-sm text-red-400">{sessionError}</p>}
          <Button className="w-full" disabled={!consent || starting} onClick={startSession}>
            {starting ? "Opening…" : "View brochure"}
          </Button>
        </div>
      </div>
    );
  }

  return <BrochureViewer brochure={brochure} sessionId={sessionId} />;
}
