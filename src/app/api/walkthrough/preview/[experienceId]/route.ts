import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

export async function POST(_req: Request, { params }: { params: Promise<{ experienceId: string }> }) {
  return withAuth(async (profile) => {
    const { experienceId } = await params;
    const admin = createAdminClient();

    const { data: exp, error } = await admin
      .from("experiences")
      .select("id, slug, status, type, organization_id")
      .eq("id", experienceId)
      .eq("organization_id", profile.organization_id!)
      .single();

    if (error || !exp) return jsonError("Experience not found", 404);
    if (exp.type !== "cinematic_walkthrough") return jsonError("Not a Property Walkthrough experience", 400);

    if (exp.status === "draft" || exp.status === "processing") {
      const { error: updateError } = await admin
        .from("experiences")
        .update({ status: "ready_for_review", updated_at: new Date().toISOString() })
        .eq("id", experienceId);
      if (updateError) return jsonError(updateError.message, 500);
    }

    const slug = exp.slug ?? experienceId;
    return NextResponse.json({
      previewUrl: `/walkthrough/${slug}?preview=1`,
      slug,
      status: exp.status === "draft" || exp.status === "processing" ? "ready_for_review" : exp.status,
    });
  });
}
