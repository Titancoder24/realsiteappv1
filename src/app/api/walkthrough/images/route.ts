import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { mediaService } from "@/services/media.service";
import { ensureWalkthroughChecklist, MAX_IMAGES, refreshWalkthroughChecklist } from "@/services/walkthrough.service";

export async function GET(req: Request) {
  return withAuth(async () => {
    const experienceId = new URL(req.url).searchParams.get("experienceId");
    if (!experienceId) return jsonError("experienceId required", 400);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("walkthrough_images")
      .select("*")
      .eq("experience_id", experienceId)
      .order("sort_order");
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const experienceId = formData.get("experienceId") as string | null;
    const propertyId = formData.get("propertyId") as string | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file || !experienceId || !propertyId) return jsonError("file, experienceId, propertyId required", 400);

    const admin = createAdminClient();
    const { count } = await admin
      .from("walkthrough_images")
      .select("*", { count: "exact", head: true })
      .eq("experience_id", experienceId);

    if ((count ?? 0) >= MAX_IMAGES) return jsonError(`Maximum ${MAX_IMAGES} images per walkthrough`, 400);

    const asset = await mediaService.uploadToStorage(file, profile.organization_id, propertyId);
    await ensureWalkthroughChecklist(experienceId);

    const { data, error } = await admin.from("walkthrough_images").insert({
      experience_id: experienceId,
      property_id: propertyId,
      organization_id: profile.organization_id,
      project_id: projectId ?? null,
      original_image_url: asset.file_url,
      thumbnail_url: asset.file_url,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      upload_status: "ready",
      enhancement_status: "pending",
      sort_order: count ?? 0,
      uploaded_by: profile.id,
    }).select().single();

    if (error) return jsonError(error.message, 500);
    await refreshWalkthroughChecklist(experienceId);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
