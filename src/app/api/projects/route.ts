import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";

const schema = z.object({
  name: z.string().min(1),
  project_type: z.string().optional(),
  city: z.string().optional(),
  locality: z.string().optional(),
  address: z.string().optional(),
  rera_number: z.string().optional(),
  possession_timeline: z.string().optional(),
  branding: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function GET() {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("projects")
      .select("*, properties(count)")
      .eq("organization_id", profile.organization_id)
      .order("updated_at", { ascending: false });
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data);
  }, "viewer");
}

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = schema.parse(await req.json());
    const admin = createAdminClient();
    const { data, error } = await admin.from("projects").insert({
      ...body,
      organization_id: profile.organization_id,
    }).select().single();
    if (error) return jsonError(error.message, 500);
    return NextResponse.json(data, { status: 201 });
  }, "project_manager");
}
