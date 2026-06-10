import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError, slugify } from "@/lib/api-utils";

const schema = z.object({
  property_id: z.string().uuid(),
  type: z.enum(["360_realistic", "worldlabs_splat", "immersive_world", "mobile_360_capture"]),
  primary_experience: z.boolean().optional(),
});

export async function GET(req: Request) {
  return withAuth(async (profile) => {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get("propertyId");
    const admin = createAdminClient();
    let q = admin.from("experiences").select("*, property_id, properties(name, project_id)").eq("organization_id", profile.organization_id!);
    if (propertyId) q = q.eq("property_id", propertyId);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  });
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    const { data: property } = await admin.from("properties").select("name").eq("id", body.property_id).single();
    const slug = slugify(`${property?.name ?? "property"}-${body.type}-${Date.now().toString(36)}`);

    const { data, error } = await admin.from("experiences").insert({
      property_id: body.property_id,
      organization_id: profile.organization_id,
      type: body.type,
      status: "draft",
      slug,
      primary_experience: body.primary_experience ?? false,
    }).select().single();

    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
