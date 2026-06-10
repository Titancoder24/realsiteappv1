import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { env } from "@/lib/env";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (profile) => {
    const admin = createAdminClient();
    const { data: exp, error } = await admin.from("experiences").select("*, properties(name)").eq("id", id).eq("organization_id", profile.organization_id!).single();
    if (error || !exp) return jsonError("Not found", 404);

    if (!exp.slug) return jsonError("Experience missing slug", 400);

    const publishedUrl = exp.type === "cinematic_walkthrough"
      ? `${env.NEXT_PUBLIC_APP_URL}/walkthrough/${exp.slug}`
      : `${env.NEXT_PUBLIC_APP_URL}/view/${exp.slug}`;

    if (exp.primary_experience) {
      await admin.from("experiences").update({ primary_experience: false }).eq("property_id", exp.property_id);
    }

    const { data, error: updateError } = await admin.from("experiences").update({
      status: "published",
      published_url: publishedUrl,
      primary_experience: true,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();

    if (updateError) return jsonError(updateError.message, 500);

    await admin.from("properties").update({ publish_status: "published" }).eq("id", exp.property_id);

    return NextResponse.json({ ...data, publishedUrl });
  }, "project_manager");
}
