import { NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-utils";
import { mediaService } from "@/services/media.service";
import { createBrochure, listBrochures } from "@/services/brochure.service";

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const propertyId = new URL(req.url).searchParams.get("propertyId") ?? undefined;
    const data = await listBrochures(profile.organization_id!, propertyId);
    return NextResponse.json(data);
  }, "sales_agent");
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("propertyId") as string | null;
    const projectId = formData.get("projectId") as string | null;
    const title = formData.get("title") as string | null;
    const pageCount = Number(formData.get("pageCount") ?? "1");

    if (!file || !propertyId || !title) return jsonError("file, propertyId, title required", 400);
    if (file.type !== "application/pdf") return jsonError("Only PDF brochures are supported", 400);

    const asset = await mediaService.uploadToStorage(file, profile.organization_id!, propertyId);
    const brochure = await createBrochure({
      organizationId: profile.organization_id!,
      propertyId,
      projectId: projectId ?? undefined,
      title,
      fileUrl: asset.file_url,
      pageCount: Number.isFinite(pageCount) ? pageCount : 1,
      createdBy: profile.id,
    });

    return NextResponse.json(brochure, { status: 201 });
  }, "project_manager");
}
