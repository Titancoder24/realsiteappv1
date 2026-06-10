import type { AIResponse } from "@/types/domain";
import { openRouterService } from "./openrouter.service";
import { ragService } from "./rag.service";

const FALLBACK =
  "I do not have that exact information in the developer-approved property data. I can connect you with the sales team to confirm it.";

export class AIService {
  async answer(params: {
    organizationId: string;
    propertyId: string;
    query: string;
    sceneId?: string;
    checkpointId?: string;
    sessionId?: string;
  }): Promise<AIResponse> {
    const contexts = await ragService.retrieve({
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      query: params.query,
      sceneId: params.sceneId,
      checkpointId: params.checkpointId,
    });

    const sensitive = openRouterService.isSensitiveQuery(params.query);
    const fallbackUsed = openRouterService.shouldFallback(contexts, params.query);

    if (fallbackUsed) {
      return {
        answer: FALLBACK,
        retrievedSources: contexts,
        confidenceScore: openRouterService.computeConfidence(contexts, params.query),
        sensitiveTopic: sensitive,
        fallbackUsed: true,
        humanEscalation: sensitive,
      };
    }

    const messages = openRouterService.buildGroundedMessages(params.query, contexts, params.sceneId);
    const completion = await openRouterService.chat({ messages, temperature: 0.15 });
    const answer = completion.choices?.[0]?.message?.content ?? FALLBACK;
    const confidence = openRouterService.computeConfidence(contexts, params.query);

    return {
      answer,
      retrievedSources: contexts,
      confidenceScore: confidence,
      sensitiveTopic: sensitive,
      fallbackUsed: answer === FALLBACK,
      humanEscalation: sensitive && confidence < 0.6,
    };
  }
}

export const aiService = new AIService();
