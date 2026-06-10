import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { stitchService } from "@/services/stitch.service";

const schema = z.object({
  stitched_image_url: z.string().url().optional(),
  panorama_config: z.object({
    type: z.literal("equirectangular").optional(),
    haov: z.number().optional(),
    vaov: z.number().optional(),
    vOffset: z.number().optional(),
    hfov: z.number().optional(),
  }).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async () => {
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    try {
      const result = await stitchService.processRoom(id, body.stitched_image_url, body.panorama_config);
      return NextResponse.json(result);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Stitch failed", 500);
    }
  }, "project_manager");
}
