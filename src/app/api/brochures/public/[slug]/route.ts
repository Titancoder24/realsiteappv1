import { NextResponse } from "next/server";
import { getPublicBrochure } from "@/services/brochure.service";
import { jsonError } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPublicBrochure(slug);
  if (!data) return jsonError("Brochure not found", 404);
  return NextResponse.json(data);
}
