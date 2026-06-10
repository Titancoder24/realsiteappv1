import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api-utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  const admin = createAdminClient();

  const select = `
      id, type, status, slug, viewer_config, organization_id, property_id,
      properties(id, name, project_id, projects(name, branding, organizations(branding))),
      tour_360_scenes(*),
      property_scenes(*, scene_annotations(*)),
      splat_worlds(*),
      floor_maps(*),
      checkpoints(*)
    `;

  const isUuid = UUID_RE.test(slug);
  let query = admin.from("experiences").select(select);
  query = isUuid ? query.eq("id", slug) : query.eq("slug", slug);

  if (preview) {
    query = query.in("status", ["published", "ready_for_review"]);
  } else {
    query = query.eq("status", "published");
  }

  const { data: exp, error } = await query.single();

  if (error || !exp) return jsonError("Experience not found", 404);
  return NextResponse.json(exp);
}
