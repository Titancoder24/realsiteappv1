import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPdfFile, pdfContentType } from "@/lib/brochure/pdf-utils";

const schema = z.object({
  fileName: z.string().min(1),
  propertyId: z.string().uuid(),
  contentType: z.string().optional(),
});

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const body = schema.parse(await req.json());
    const file = { name: body.fileName, type: body.contentType ?? "application/pdf" };
    if (!isPdfFile(file)) return jsonError("Only PDF brochures are supported", 400);

    const admin = createAdminClient();
    const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${profile.organization_id}/${body.propertyId}/brochures/${Date.now()}-${safeName}`;

    const { data, error } = await admin.storage.from("media").createSignedUploadUrl(path);
    if (error || !data) return jsonError(error?.message ?? "Could not prepare upload", 500);

    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl,
      contentType: pdfContentType(file),
    });
  }, "sales_agent");
}
