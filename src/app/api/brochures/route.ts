import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, jsonError } from "@/lib/api-utils";
import { mediaService } from "@/services/media.service";
import { createBrochure, listBrochures } from "@/services/brochure.service";
import { isPdfFile } from "@/lib/brochure/pdf-utils";
import { countPdfPages } from "@/lib/brochure/pdf-page-count";

const jsonSchema = z.object({
  propertyId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().min(1),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSize: z.coerce.number().optional(),
  pageCount: z.coerce.number().optional(),
  publish: z.boolean().optional(),
});

async function resolvePageCount(buffer: ArrayBuffer | null, fallback: number) {
  if (!buffer) return Math.max(1, fallback);
  try {
    return Math.max(1, await countPdfPages(buffer));
  } catch {
    return Math.max(1, fallback);
  }
}

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const propertyId = new URL(req.url).searchParams.get("propertyId") ?? undefined;
    const data = await listBrochures(profile.organization_id!, propertyId);
    return NextResponse.json(data);
  }, "sales_agent");
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = jsonSchema.parse(await req.json());
      const file = { name: body.fileName, type: "application/pdf" };
      if (!isPdfFile(file)) return jsonError("Only PDF brochures are supported", 400);

      const asset = await mediaService.registerStoredFile({
        organizationId: profile.organization_id!,
        propertyId: body.propertyId,
        fileName: body.fileName,
        fileUrl: body.fileUrl,
        contentType: "application/pdf",
        fileSize: body.fileSize,
      });

      const brochure = await createBrochure({
        organizationId: profile.organization_id!,
        propertyId: body.propertyId,
        projectId: body.projectId,
        title: body.title,
        fileUrl: asset.file_url,
        pageCount: Math.max(1, body.pageCount ?? 1),
        createdBy: profile.id,
        status: body.publish === false ? "draft" : "published",
      });

      return NextResponse.json(brochure, { status: 201 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("propertyId") as string | null;
    const projectId = formData.get("projectId") as string | null;
    const title = formData.get("title") as string | null;
    const pageCount = Number(formData.get("pageCount") ?? "1");
    const publish = formData.get("publish") !== "false";

    if (!file || !propertyId || !title) return jsonError("file, propertyId, title required", 400);
    if (!isPdfFile(file)) return jsonError("Only PDF brochures are supported", 400);

    const buffer = await file.arrayBuffer();
    const resolvedPageCount = await resolvePageCount(buffer, Number.isFinite(pageCount) ? pageCount : 1);

    const asset = await mediaService.uploadBufferToStorage({
      buffer,
      fileName: file.name,
      contentType: file.type || "application/pdf",
      organizationId: profile.organization_id!,
      propertyId,
      folder: "brochures",
    });

    const brochure = await createBrochure({
      organizationId: profile.organization_id!,
      propertyId,
      projectId: projectId ?? undefined,
      title,
      fileUrl: asset.file_url,
      pageCount: resolvedPageCount,
      createdBy: profile.id,
      status: publish ? "published" : "draft",
    });

    return NextResponse.json(brochure, { status: 201 });
  }, "sales_agent");
}
