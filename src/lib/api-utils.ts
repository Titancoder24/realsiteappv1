import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth/session";
import type { UserRole } from "@/types/domain";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function withAuth(handler: (profile: Awaited<ReturnType<typeof requireProfile>>) => Promise<Response>, minRole?: UserRole) {
  try {
    const profile = await requireProfile(minRole);
    return await handler(profile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg === "Unauthorized") return jsonError("Unauthorized", 401);
    if (msg === "Forbidden") return jsonError("Forbidden", 403);
    return jsonError(msg, 500);
  }
}

export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
