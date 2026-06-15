import { NextResponse } from "next/server";
import { getPublicBrochure } from "@/services/brochure.service";
import { jsonError } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brochure = await getPublicBrochure(slug);
  if (!brochure?.file_url) return jsonError("Brochure not found", 404);

  const upstream = await fetch(brochure.file_url, { cache: "no-store" });
  if (!upstream.ok) return jsonError("Failed to load brochure PDF", 502);

  const bytes = await upstream.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${brochure.slug}.pdf"`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
