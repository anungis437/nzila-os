/**
 * Semantic Knowledge Indexer
 *
 * Generates vector embeddings for published exit interview content and upserts
 * them into the knowledge_base table for RAG retrieval.
 *
 * Privacy contract:
 * - Org-scoped: embeddings are never shared cross-org
 * - Sensitivity gate: legal_sensitive + executive_confidential are SKIPPED
 * - Consent gate: interviews without consent_granted are SKIPPED
 * - Lineage: every kb record has sourceType='exit_interview' + sourceId=interview.id
 *
 * INV-01: All AI calls routed through @nzila/ai-sdk via getAiClient()
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews, knowledgeBase } from '@/db/schema';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { embeddingCache } from '@/lib/services/ai/embedding-cache';
import { logger } from '@/lib/logger';
import type { ExitInterview } from '@/db/schema';

// Sensitivity levels that bypass RAG indexing regardless of consent
const INDEXING_BLOCKED_SENSITIVITY = new Set(['legal_sensitive', 'executive_confidential'] as const);

async function generateEmbedding(text: string): Promise<number[]> {
  const cached = await embeddingCache.getCachedEmbedding(text, 'ai-sdk');
  if (cached) return cached;

  const ai = getAiClient();
  const result = await ai.embed({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.EMBEDDINGS,
    input: text,
    dataClass: 'internal',
  });
  const embedding = result.embeddings[0];
  embeddingCache.setCachedEmbedding(text, 'ai-sdk', embedding).catch(() => {});
  return embedding;
}

/**
 * Build a single indexable text block from an interview.
 * Sections are labelled so chunk retrieval can reconstruct provenance.
 */
export function buildIndexableContent(interview: ExitInterview): string {
  const sections: string[] = [
    `# ${interview.title}`,
    `Role: ${interview.roleInUnion} | Years of service: ${interview.yearsOfService}`,
  ];

  if (interview.summary) sections.push(`## Summary\n${interview.summary}`);
  if (interview.keyLessons) sections.push(`## Key lessons\n${interview.keyLessons}`);
  if (interview.bestPractices) sections.push(`## Best practices\n${interview.bestPractices}`);
  if (interview.bargainingAdvice) sections.push(`## Bargaining advice\n${interview.bargainingAdvice}`);
  if (interview.mediationAdvice) sections.push(`## Mediation advice\n${interview.mediationAdvice}`);
  if (interview.incomingOfficerAdvice) sections.push(`## Incoming officer advice\n${interview.incomingOfficerAdvice}`);
  if (interview.expertiseTags?.length) sections.push(`## Expertise areas\n${interview.expertiseTags.join(', ')}`);
  if (interview.topics?.length) sections.push(`## Topics\n${interview.topics.join(', ')}`);

  return sections.join('\n\n');
}

export type IndexResult =
  | { indexed: true; knowledgeBaseId: string }
  | { indexed: false; reason: string };

/**
 * Index a single exit interview into the vector knowledge base.
 * Idempotent — will upsert if knowledgeBaseId already set.
 */
export async function indexExitInterview(
  interviewId: string,
  orgId: string,
  userId: string,
): Promise<IndexResult> {
  try {
    // Mark as indexing early to prevent concurrent duplicate attempts
    await db
      .update(exitInterviews)
      .set({ indexingStatus: 'indexing', updatedAt: new Date() })
      .where(and(eq(exitInterviews.id, interviewId), eq(exitInterviews.organizationId, orgId)));

    const [interview] = await db
      .select()
      .from(exitInterviews)
      .where(and(eq(exitInterviews.id, interviewId), eq(exitInterviews.organizationId, orgId)))
      .limit(1);

    if (!interview) {
      return { indexed: false, reason: 'Interview not found' };
    }

    // Governance gate
    if (INDEXING_BLOCKED_SENSITIVITY.has(interview.sensitivityLevel as never)) {
      await db
        .update(exitInterviews)
        .set({ indexingStatus: 'skipped', updatedAt: new Date() })
        .where(eq(exitInterviews.id, interviewId));
      return { indexed: false, reason: `Sensitivity level '${interview.sensitivityLevel}' blocks indexing` };
    }

    // Consent gate
    if (!interview.consentGranted) {
      await db
        .update(exitInterviews)
        .set({ indexingStatus: 'skipped', updatedAt: new Date() })
        .where(eq(exitInterviews.id, interviewId));
      return { indexed: false, reason: 'Retiree consent not granted' };
    }

    const content = buildIndexableContent(interview);
    const embedding = await generateEmbedding(content);
    const now = new Date();

    if (interview.knowledgeBaseId) {
      // Upsert
      await db
        .update(knowledgeBase)
        .set({
          content,
          embedding: embedding as never,
          embeddingModel: 'text-embedding-3-small',
          embeddingModelVersion: 'text-embedding-3-small@v1',
          tags: interview.topics ?? [],
          keywords: interview.expertiseTags ?? [],
          updatedAt: now,
        })
        .where(eq(knowledgeBase.id, interview.knowledgeBaseId));

      await db
        .update(exitInterviews)
        .set({ indexingStatus: 'indexed', indexedAt: now, updatedAt: now })
        .where(eq(exitInterviews.id, interviewId));

      return { indexed: true, knowledgeBaseId: interview.knowledgeBaseId };
    }

    // First index — create kb record
    const [kbRecord] = await db
      .insert(knowledgeBase)
      .values({
        organizationId: orgId,
        title: interview.title,
        documentType: 'guide',
        content,
        summary: interview.summary ?? undefined,
        sourceType: 'exit_interview',
        sourceId: interview.id,
        embedding: embedding as never,
        embeddingModel: 'text-embedding-3-small',
        embeddingModelVersion: 'text-embedding-3-small@v1',
        tags: interview.topics ?? [],
        keywords: interview.expertiseTags ?? [],
        isPublic: false,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db
      .update(exitInterviews)
      .set({
        knowledgeBaseId: kbRecord.id,
        indexingStatus: 'indexed',
        indexedAt: now,
        updatedAt: now,
      })
      .where(eq(exitInterviews.id, interviewId));

    return { indexed: true, knowledgeBaseId: kbRecord.id };
  } catch (err) {
    logger?.error('Semantic indexing failed', { interviewId, error: String(err) });
    await db
      .update(exitInterviews)
      .set({ indexingStatus: 'failed', updatedAt: new Date() })
      .where(eq(exitInterviews.id, interviewId))
      .catch(() => {});
    return { indexed: false, reason: String(err) };
  }
}
