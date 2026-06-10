import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api-utils";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: exp, error } = await admin
    .from("experiences")
    .select(`
      id, type, status, slug, viewer_config, organization_id, property_id,
      properties(id, name, project_id, projects(name, branding, organizations(branding))),
      tour_360_scenes(*),
      splat_worlds(*),
      floor_maps(*),
      checkpoints(*)
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !exp) return jsonError("Experience not found", 404);
  return NextResponse.json(exp);
}
