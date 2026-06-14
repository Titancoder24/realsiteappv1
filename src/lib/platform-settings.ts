import { createAdminClient } from "@/lib/supabase/admin";

export type WalkthroughAIProvider = "openrouter" | "vertex";

export interface VertexAIConfig {
  api_key?: string;
  project_id?: string;
  location?: string;
  planner_model?: string;
  video_model?: string;
}

export interface SuperAdminConfig {
  username: string;
  email: string;
  password_hash?: string;
  configured: boolean;
}

const cache = new Map<string, { value: unknown; expires: number }>();
const TTL_MS = 30_000;

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const admin = createAdminClient();
  const { data } = await admin.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const value = (data?.value as T) ?? fallback;
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export async function setPlatformSetting(key: string, value: unknown, updatedBy?: string) {
  const admin = createAdminClient();
  await admin.from("platform_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy ?? null,
  });
  cache.delete(key);
}

export async function getWalkthroughAIProvider(): Promise<WalkthroughAIProvider> {
  const v = await getSetting<string>("walkthrough_ai_provider", "openrouter");
  return v === "vertex" ? "vertex" : "openrouter";
}

export async function getVertexAIConfig(): Promise<VertexAIConfig> {
  return getSetting<VertexAIConfig>("vertex_ai_config", {
    planner_model: "gemini-2.5-flash",
    video_model: "veo-3.1-lite-generate-preview",
    location: "us-central1",
  });
}

export async function getSuperAdminConfig(): Promise<SuperAdminConfig> {
  return getSetting<SuperAdminConfig>("super_admin", {
    username: "superadmin",
    email: "superadmin@realsite.platform",
    configured: false,
  });
}

export function clearPlatformSettingsCache() {
  cache.clear();
}
