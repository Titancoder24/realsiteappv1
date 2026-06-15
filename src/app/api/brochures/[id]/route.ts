import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { getBrochureById, updateBrochure } from "@/services/brochure.service";

const patchSchema = z.object({
  title: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  page_count: z.coerce.number().optional(),
  tracking_enabled: z.boolean().optional(),
  consent_notice: z.string().optional(),
  sales_alert_email: z.string().optional(),
  sales_whatsapp: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (profile) => {
    const { id } = await params;
    const data = await getBrochureById(id, profile.organization_id!);
    return NextResponse.json(data);
  }, "sales_agent");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(async (profile) => {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const data = await updateBrochure(id, profile.organization_id!, body);
    return NextResponse.json(data);
  }, "project_manager");
}
