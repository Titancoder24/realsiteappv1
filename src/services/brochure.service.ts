import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/api-utils";
import type { BrochurePageCategory, PropertyBrochure } from "@/types/brochure-intelligence";

const DEFAULT_PAGE_CATEGORIES: BrochurePageCategory[] = [
  "overview", "floor_plan", "pricing", "amenities", "location", "payment_plan", "contact",
];

export async function listBrochures(organizationId: string, propertyId?: string) {
  const admin = createAdminClient();
  let query = admin
    .from("property_brochures")
    .select("*, properties(name, projects(name)), brochure_pages(*)")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (propertyId) query = query.eq("property_id", propertyId);
  const { data, error } = await query;
  if (error) throw error;
  return data as PropertyBrochure[];
}

export async function getBrochureById(id: string, organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("property_brochures")
    .select("*, properties(name, projects(name)), brochure_pages(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (error) throw error;
  return data as PropertyBrochure;
}

export async function getPublicBrochure(slug: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("property_brochures")
    .select("id, title, slug, file_url, page_count, tracking_enabled, consent_notice, property_id, organization_id, properties(name, projects(name, branding)), brochure_pages(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (error || !data) return null;
  return data;
}

export async function createBrochure(params: {
  organizationId: string;
  propertyId: string;
  projectId?: string;
  title: string;
  fileUrl: string;
  pageCount?: number;
  createdBy?: string;
  status?: "draft" | "published" | "archived";
}) {
  const admin = createAdminClient();
  const slug = slugify(`${params.title}-${Date.now().toString(36)}`);
  const pageCount = Math.max(1, params.pageCount ?? 1);

  const { data, error } = await admin.from("property_brochures").insert({
    organization_id: params.organizationId,
    property_id: params.propertyId,
    project_id: params.projectId ?? null,
    title: params.title,
    slug,
    file_url: params.fileUrl,
    page_count: pageCount,
    status: params.status ?? "draft",
    created_by: params.createdBy,
  }).select().single();
  if (error) throw error;

  const pages = Array.from({ length: pageCount }, (_, i) => ({
    brochure_id: data.id,
    page_number: i + 1,
    title: `Page ${i + 1}`,
    category: DEFAULT_PAGE_CATEGORIES[i] ?? "general",
  }));
  await admin.from("brochure_pages").insert(pages);

  return data as PropertyBrochure;
}

export async function updateBrochure(id: string, organizationId: string, patch: Record<string, unknown>) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("property_brochures")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBrochurePage(
  brochureId: string,
  pageNumber: number,
  patch: { title?: string; category?: string; section_labels?: unknown[] },
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brochure_pages")
    .update(patch)
    .eq("brochure_id", brochureId)
    .eq("page_number", pageNumber)
    .select()
    .single();
  if (error) throw error;
  return data;
}
