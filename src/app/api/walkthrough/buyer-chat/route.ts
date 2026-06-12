import { NextResponse } from "next/server";
import { walkthroughAgentService } from "@/services/walkthrough-agent.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      organizationId,
      propertyId,
      experienceId,
      query,
      activeSceneId,
      sessionId,
    } = body as {
      organizationId: string;
      propertyId: string;
      experienceId: string;
      query: string;
      activeSceneId?: string;
      sessionId?: string;
    };

    if (!organizationId || !propertyId || !experienceId || !query?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await walkthroughAgentService.chat({
      organizationId,
      propertyId,
      experienceId,
      query: query.trim(),
      activeSceneId,
      sessionId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
