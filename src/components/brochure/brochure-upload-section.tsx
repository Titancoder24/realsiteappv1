"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ExternalLink, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import { getPdfPageCount } from "@/lib/brochure/pdf-client";
import { isPdfFile, pdfContentType } from "@/lib/brochure/pdf-utils";

interface BrochureRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  properties?: { name: string };
}

export function BrochureUploadSection() {
  const [brochures, setBrochures] = useState<BrochureRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [propertyId, setPropertyId] = useState("");
  const [title, setTitle] = useState("");
  const [pageCount, setPageCount] = useState("8");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  const load = () => {
    fetch("/api/brochures/analytics")
      .then((r) => r.json())
      .then((d) => setBrochures(d.brochures ?? []))
      .catch(() => toast.error("Failed to load brochures"));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { id: string; name: string }[]) => setProperties(rows))
      .catch(() => {});
  }, []);

  async function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPdfFile(file)) {
      toast.error("Please choose a PDF file");
      e.target.value = "";
      return;
    }

    const resolvedTitle = title || file.name.replace(/\.pdf$/i, "");
    if (!propertyId || !resolvedTitle) {
      toast.error("Select a property and add a title before uploading");
      e.target.value = "";
      return;
    }

    if (!title) setTitle(resolvedTitle);

    let count = Number(pageCount);
    try {
      count = await getPdfPageCount(file);
      setPageCount(String(count));
    } catch {
      toast.message("Page count could not be auto-detected — using your entered value");
    }

    setUploading(true);
    try {
      const prepRes = await fetch("/api/brochures/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, propertyId, contentType: pdfContentType(file) }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok) throw new Error(prep.error ?? "Could not prepare upload");

      let uploaded = false;
      if (prep.signedUrl) {
        const uploadRes = await fetch(prep.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": prep.contentType },
          body: file,
        });
        uploaded = uploadRes.ok;
      }

      if (!uploaded) {
        if (file.size <= 4 * 1024 * 1024) {
          const form = new FormData();
          form.append("file", file);
          form.append("propertyId", propertyId);
          form.append("title", resolvedTitle);
          form.append("pageCount", String(Number.isFinite(count) && count > 0 ? count : Number(pageCount) || 1));
          form.append("publish", "true");
          const fallbackRes = await fetch("/api/brochures", { method: "POST", body: form });
          const fallbackJson = await fallbackRes.json();
          if (!fallbackRes.ok) throw new Error(fallbackJson.error ?? "Storage upload failed");
          toast.success("Brochure published — copy the tracked link below");
          setTitle("");
          load();
          return;
        }
        throw new Error("Direct storage upload failed. Try a smaller PDF or contact support.");
      }

      const createRes = await fetch("/api/brochures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          title: resolvedTitle,
          fileUrl: prep.publicUrl,
          fileName: file.name,
          fileSize: file.size,
          pageCount: Number.isFinite(count) && count > 0 ? count : Number(pageCount) || 1,
          publish: true,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? "Could not save brochure");

      toast.success("Brochure published — copy the tracked link below");
      setTitle("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function shareUrl(slug: string) {
    if (typeof window === "undefined") return `/brochure/${slug}`;
    return `${window.location.origin}/brochure/${slug}`;
  }

  async function copyShareLink(slug: string) {
    await navigator.clipboard.writeText(shareUrl(slug));
    toast.success("Tracked share link copied");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Published brochures", value: brochures.length },
          { label: "Tracking", value: "Name + phone gate" },
          { label: "Share", value: "Copy tracked link" },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2"><CardDescription>{k.label}</CardDescription></CardHeader>
            <CardContent><div className="text-lg font-semibold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload tracked brochure</CardTitle>
          <CardDescription>Upload a PDF first. Every viewer must identify with name and phone before viewing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {properties.length === 0 && (
            <p className="text-xs text-muted-foreground">No properties found. Create a property first, then upload.</p>
          )}
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">Select property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Input placeholder="Brochure title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="Page count (auto-detected when possible)" value={pageCount} onChange={(e) => setPageCount(e.target.value)} />
          <label className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted ${uploading ? "opacity-60" : ""}`}>
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading PDF…" : "Choose PDF brochure"}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFileSelect} disabled={uploading} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracked brochure links</CardTitle>
          <CardDescription>Share these links with buyers. Engagement is tracked per identified viewer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {brochures.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.properties?.name} · {b.status}</p>
                <p className="mt-1 flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3 shrink-0" />
                  {shareUrl(b.slug)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => copyShareLink(b.slug)}>
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/brochure/${b.slug}`} target="_blank">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                  </Link>
                </Button>
              </div>
            </div>
          ))}
          {!brochures.length && (
            <p className="text-sm text-muted-foreground">Upload your first brochure above to get a tracked share link.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
