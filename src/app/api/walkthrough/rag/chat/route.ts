import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { withAuth, jsonError } from "@/lib/api-utils";
import { walkthroughPlannerService } from "@/services/walkthrough-planner.service";
import { refreshWalkthroughChecklist, saveRagEntriesFromChat } from "@/services/walkthrough.service";

const schema = z.object({
  experience_id: z.string().uuid(),
  property_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  message: z.string().min(1),
  attachments: z.array(z.object({ name: z.string(), url: z.string().optional(), text: z.string().optional() })).optional(),
});

export async function POST(req: Request) {
  return withAuth(async (profile) => {
    if (!profile.organization_id) return jsonError("No organization", 400);
    const body = schema.parse(await req.json());
    const admin = createAdminClient();

    let sessionId = body.session_id;
    if (!sessionId) {
      const { data: session } = await admin.from("walkthrough_rag_sessions").insert({
        experience_id: body.experience_id,
        property_id: body.property_id,
        organization_id: profile.organization_id,
        created_by: profile.id,
      }).select().single();
      sessionId = session!.id;
    }

    const attachmentText = body.attachments?.map((a) => a.text ?? a.name).filter(Boolean).join("\n") ?? "";
    const fullMessage = attachmentText ? `${body.message}\n\nAttached context:\n${attachmentText}` : body.message;

    await admin.from("walkthrough_rag_messages").insert({
      session_id: sessionId,
      role: "user",
      content: fullMessage,
      attachments: body.attachments ?? [],
    });

    const { data: history } = await admin
      .from("walkthrough_rag_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at")
      .limit(20);

    const { reply, entries } = await walkthroughPlannerService.extractRagFromChat(
      fullMessage,
      (history ?? []).slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
    );

    const saved = await saveRagEntriesFromChat(body.property_id, profile.organization_id, entries, profile.id);

    await admin.from("walkthrough_rag_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
      extracted_entries: saved,
    });

    await refreshWalkthroughChecklist(body.experience_id);

    return NextResponse.json({
      session_id: sessionId,
      reply,
      entries_saved: saved.length,
      entries: saved,
    });
  }, "project_manager");
}
