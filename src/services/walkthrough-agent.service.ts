import { GEMINI_35_FLASH_MODEL, sendChatCompletion } from "@/lib/openrouter";
import type { WalkthroughAICommand } from "@/lib/walkthrough-player-controller";
import { ragService } from "./rag.service";
import { openRouterService } from "./openrouter.service";
import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK =
  "I do not have that exact information in the developer-approved property data. I can connect you with the sales team to confirm it.";

export class WalkthroughAgentService {
  private get model() {
    return process.env.OPENROUTER_PRIMARY_MODEL ?? GEMINI_35_FLASH_MODEL;
  }

  async resolveNavigation(
    query: string,
    experienceId: string,
  ): Promise<{ sceneId?: string; annotationId?: string; label?: string } | null> {
    const admin = createAdminClient();
    const q = query.toLowerCase();

    const { data: scenes } = await admin
      .from("walkthrough_scenes")
      .select("id, title, room_type, description, caption, ai_context")
      .eq("experience_id", experienceId)
      .order("scene_order");

    for (const scene of scenes ?? []) {
      const hay = [scene.title, scene.room_type, scene.description, scene.caption, scene.ai_context]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(q) || q.split(/\s+/).some((w) => w.length > 3 && hay.includes(w))) {
        return { sceneId: scene.id, label: scene.title };
      }
    }

    const { data: anns } = await admin
      .from("walkthrough_annotations")
      .select("id, scene_id, title, short_description, description, ai_context")
      .eq("experience_id", experienceId)
      .eq("visibility", "public");

    for (const ann of anns ?? []) {
      const hay = [ann.title, ann.short_description, ann.description, ann.ai_context]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(q) || q.split(/\s+/).some((w) => w.length > 3 && hay.includes(w))) {
        return { sceneId: ann.scene_id, annotationId: ann.id, label: ann.title };
      }
    }

    return null;
  }

  async chat(params: {
    organizationId: string;
    propertyId: string;
    experienceId: string;
    query: string;
    activeSceneId?: string;
    sessionId?: string;
  }): Promise<{
    answer: string;
    command: WalkthroughAICommand;
    confidenceScore: number;
    suggestedFollowups: string[];
    fallbackUsed: boolean;
  }> {
    const contexts = await ragService.retrieve({
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      query: params.query,
      sceneId: params.activeSceneId,
    });

    const nav = await this.resolveNavigation(params.query, params.experienceId);
    const fallbackUsed = openRouterService.shouldFallback(contexts, params.query);

    let command: WalkthroughAICommand = { command: "NONE" };
    if (/site visit|book|schedule|contact|call/i.test(params.query)) {
      command = { command: "OPEN_LEAD_FORM" };
    } else if (nav?.annotationId && nav.sceneId) {
      command = { command: "HIGHLIGHT_ANNOTATION", annotationId: nav.annotationId, sceneId: nav.sceneId };
    } else if (nav?.sceneId) {
      command = { command: "JUMP_TO_SCENE", sceneId: nav.sceneId };
    } else if (/show.*room|which room|rooms available/i.test(params.query)) {
      command = { command: "SHOW_ROOM_MENU" };
    }

    if (fallbackUsed && !nav && command.command === "NONE") {
      return {
        answer: FALLBACK,
        command,
        confidenceScore: 0,
        suggestedFollowups: ["Show me the living room", "What amenities are available?", "Book a site visit"],
        fallbackUsed: true,
      };
    }

    const sceneList = nav?.label ? `Navigation match: ${nav.label}` : "";
    const messages = openRouterService.buildGroundedMessages(
      params.query,
      contexts,
      params.activeSceneId ? `active scene ${params.activeSceneId}. ${sceneList}` : sceneList,
    );

    const result = await sendChatCompletion({
      model: this.model,
      messages: [
        ...messages,
        {
          role: "system",
          content: `If the buyer asks to navigate, you may mention the room. Keep answers concise. Do not invent pricing or legal facts.`,
        },
      ],
      temperature: 0.15,
      maxTokens: 512,
    });

    const answer = result.choices?.[0]?.message?.content ?? FALLBACK;
    const confidence = openRouterService.computeConfidence(contexts, params.query);

    return {
      answer: typeof answer === "string" ? answer : FALLBACK,
      command,
      confidenceScore: confidence,
      suggestedFollowups: [
        "Show me the kitchen",
        "Point to the balcony view",
        "What amenities are included?",
        "Book a site visit",
      ],
      fallbackUsed: answer === FALLBACK,
    };
  }
}

export const walkthroughAgentService = new WalkthroughAgentService();
