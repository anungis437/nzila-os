'use server'

/**
 * AI-Powered Actions — NACP Exams.
 *
 * Exam intelligence powered by @nzila/ai-sdk and @nzila/ml-sdk:
 *   1. `runAIEmbed`       → Submission similarity detection (plagiarism)
 *   2. `runAICompletion`  → Question generation assistance for exam authors
 *   3. `runAIExtraction`  → OCR/handwriting recognition for paper submissions
 *   4. `runPrediction`    → Candidate performance prediction + integrity risk
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { buildCanonicalAiOutput, type CanonicalAiOutput } from '@nzila/ai-sdk'
import { runAICompletionDetailed, runAIEmbedDetailed, runAIExtractionDetailed } from '@/lib/ai-client'
import { runPredictionDetailed } from '@/lib/ml-client'
import { buildExamEvidencePack } from '@/lib/evidence'
import { resolveOrgContext } from '@/lib/resolve-org'

/* ─── Types ─── */

export type SimilarityResult = CanonicalAiOutput<{
  submissionIdA: string
  submissionIdB: string
  similarity: number
  flagged: boolean
  explanation: string
}>

export type GeneratedQuestion = CanonicalAiOutput<{
  text: string
  type: 'multiple-choice' | 'short-answer' | 'essay'
  difficulty: 'basic' | 'intermediate' | 'advanced'
  suggestedMark: number
  modelAnswer: string
  options?: string[]
}>

export type PaperExtraction = CanonicalAiOutput<{
  candidateId: string | null
  answers: Array<{ questionNumber: number; answerText: string; confidence: number }>
  handwritingQuality: 'clear' | 'fair' | 'poor'
}>

export type IntegrityRisk = CanonicalAiOutput<{
  candidateId: string
  riskScore: number
  factors: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }>
  recommendation: 'proceed' | 'review' | 'flag'
}>

/* ─── Plagiarism Detection ─── */

export async function checkSubmissionSimilarity(
  sessionId: string,
  submissionIds: string[],
): Promise<SimilarityResult[]> {
  const ctx = await resolveOrgContext()

  if (submissionIds.length < 2) return []

  try {
    logger.info('Running plagiarism check', { actorId: ctx.actorId, sessionId, count: submissionIds.length })

    // Fetch submission texts (org-scoped)
    const submissions = (await platformDb.execute(
      sql`SELECT org_id as id, metadata->>'answerText' as text
      FROM audit_log
      WHERE org_id = ${ctx.orgId}
        AND org_id = ANY(${submissionIds})
        AND action = 'submission.recorded'
      ORDER BY created_at DESC`,
    )) as unknown as Array<{ id: string; text: string }>

    if (submissions.length < 2) return []

    // Generate embeddings for all submissions
    const texts = submissions.map((s) => s.text ?? '')
    const embeddingResult = await runAIEmbedDetailed(texts, {
      orgId: ctx.orgId,
      profile: 'nacp-exams-embed',
    })
    const embeddings = embeddingResult.embeddings

    // Compute pairwise cosine similarity
    const results: SimilarityResult[] = []
    const THRESHOLD = 0.85

    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        const similarity = cosineSimilarity(embeddings[i], embeddings[j])
        const flagged = similarity > THRESHOLD

        if (similarity > 0.5) {
          let explanation = `Cosine similarity: ${(similarity * 100).toFixed(1)}%`
          if (flagged) {
            explanation += ' — exceeds threshold, manual review recommended.'
          }

          results.push(buildCanonicalAiOutput({
            payload: {
              submissionIdA: submissions[i].id,
              submissionIdB: submissions[j].id,
              similarity,
              flagged,
              explanation,
            },
            appKey: 'nacp-exams',
            orgId: ctx.orgId,
            execution: embeddingResult.execution,
            confidenceScore: similarity,
            evidenceRefs: ['embedding:nacp-exams-embed', 'audit_log:submission.recorded'],
            reviewRequired: flagged,
            domain: 'education',
          }))
        }
      }
    }

    if (results.some((r) => r.flagged)) {
      const _pack = await buildExamEvidencePack({
        action: 'PLAGIARISM_FLAGGED',
        entityType: 'exam_session',
        orgId: sessionId,
        actorId: ctx.actorId,
        payload: { flaggedPairs: results.filter((r) => r.flagged).length },
      })
    }

    return results.sort((a, b) => b.similarity - a.similarity)
  } catch (error) {
    logger.error('Plagiarism check failed', { error, sessionId })
    return []
  }
}

/* ─── Question Generation ─── */

export async function generateQuestions(opts: {
  subject: string
  level: string
  count: number
  existingQuestions?: string[]
}): Promise<GeneratedQuestion[]> {
  const _ctx = await resolveOrgContext()

  try {
    const existingContext = opts.existingQuestions?.length
      ? `\nAvoid duplicating these existing questions:\n${opts.existingQuestions.join('\n')}`
      : ''

    const prompt = `You are an expert exam author for the National Assessment & Certification Program (NACP).
Generate ${opts.count} exam questions for:
- Subject: ${opts.subject}
- Level: ${opts.level}
${existingContext}

Return a JSON array. Each object must have:
- "text": the question text
- "type": "multiple-choice" | "short-answer" | "essay"
- "difficulty": "basic" | "intermediate" | "advanced"
- "suggestedMark": integer (points)
- "modelAnswer": the expected correct answer
- "options": array of 4 strings (only for multiple-choice)

Ensure questions test understanding, not just recall. Vary difficulty levels.`

    const { content: raw, execution } = await runAICompletionDetailed(prompt, {
      orgId: _ctx.orgId,
      profile: 'nacp-exams-generate',
      dataClass: 'sensitive',
    })

    try {
      const questions = JSON.parse(raw)
      if (!Array.isArray(questions)) return []
      return questions.slice(0, opts.count).map((question) => buildCanonicalAiOutput({
        payload: {
          text: typeof question?.text === 'string' ? question.text : '',
          type: (question?.type as GeneratedQuestion['type']) ?? 'short-answer',
          difficulty: (question?.difficulty as GeneratedQuestion['difficulty']) ?? 'intermediate',
          suggestedMark: typeof question?.suggestedMark === 'number' ? question.suggestedMark : 0,
          modelAnswer: typeof question?.modelAnswer === 'string' ? question.modelAnswer : '',
          options: Array.isArray(question?.options) ? question.options as string[] : undefined,
        },
        appKey: 'nacp-exams',
        orgId: _ctx.orgId,
        execution,
        confidenceScore: 0.72,
        evidenceRefs: ['ai-profile:nacp-exams-generate', 'input:subject-level'],
        reviewRequired: true,
        domain: 'education',
      }))
    } catch {
      logger.warn('AI question generation returned non-JSON', { raw: raw.slice(0, 200) })
      return []
    }
  } catch (error) {
    logger.error('Question generation failed', { error })
    return []
  }
}

/* ─── Paper Exam OCR/Extraction ─── */

export async function extractPaperSubmission(
  imageBase64: string,
  candidateId: string,
): Promise<PaperExtraction | null> {
  const ctx = await resolveOrgContext()

  try {
    logger.info('Extracting paper submission', { actorId: ctx.actorId, candidateId })

    const { data, execution } = await runAIExtractionDetailed(imageBase64, 'paper-exam-ocr', {
      orgId: ctx.orgId,
      profile: 'nacp-exams-extract',
      variables: { candidateId, format: 'exam-answers' },
    })

    const _pack = await buildExamEvidencePack({
      action: 'PAPER_EXTRACTION',
      entityType: 'candidate',
      orgId: candidateId,
      actorId: ctx.actorId,
      payload: { inputLength: imageBase64.length },
    })

    return buildCanonicalAiOutput({
      payload: {
        candidateId: (data.candidateId as string) ?? candidateId,
        answers: Array.isArray(data.answers) ? data.answers as PaperExtraction['answers'] : [],
        handwritingQuality: (data.handwritingQuality as PaperExtraction['handwritingQuality']) ?? 'fair',
      },
      appKey: 'nacp-exams',
      orgId: ctx.orgId,
      execution,
      confidenceScore: 0.8,
      evidenceRefs: ['prompt:paper-exam-ocr', 'evidence_pack:PAPER_EXTRACTION'],
      reviewRequired: true,
      domain: 'education',
    })
  } catch (error) {
    logger.error('Paper extraction failed', { error, candidateId })
    return null
  }
}

/* ─── Integrity Risk Scoring ─── */

export async function assessIntegrityRisk(
  sessionId: string,
  candidateId: string,
): Promise<IntegrityRisk | null> {
  const ctx = await resolveOrgContext()

  try {
    // Try ML model first
    const mlResult = await runPredictionDetailed({
      model: 'exam-integrity-scorer',
      features: { sessionId, candidateId },
      orgId: ctx.orgId,
    })

    if (mlResult.data && typeof mlResult.data.riskScore === 'number') {
      const mlPayload = mlResult.data as Record<string, unknown>
      const mlRiskScore = typeof mlPayload.riskScore === 'number' ? mlPayload.riskScore : 0.5
      return buildCanonicalAiOutput({
        payload: {
          candidateId: typeof mlPayload.candidateId === 'string' ? mlPayload.candidateId : candidateId,
          riskScore: mlRiskScore,
          factors: Array.isArray(mlPayload.factors) ? mlPayload.factors as IntegrityRisk['factors'] : [],
          recommendation: (mlPayload.recommendation as IntegrityRisk['recommendation']) ?? 'review',
        },
        appKey: 'nacp-exams',
        orgId: ctx.orgId,
        execution: mlResult.execution ?? {
          modelUsed: 'exam-integrity-scorer',
          provider: 'ml',
          engineVersion: 'ml:exam-integrity-scorer',
        },
        confidenceScore: mlRiskScore,
        evidenceRefs: ['ml:model:exam-integrity-scorer'],
        reviewRequired: true,
        domain: 'education',
      })
    }

    // Fallback: AI heuristic from submission metadata (org-scoped)
    const submissions = (await platformDb.execute(
      sql`SELECT
        metadata->>'timingMs' as "timingMs",
        metadata->>'tabSwitches' as "tabSwitches",
        metadata->>'pasteEvents' as "pasteEvents",
        metadata->>'wordCount' as "wordCount"
      FROM audit_log
      WHERE org_id = ${ctx.orgId}
        AND org_id = ${candidateId}
        AND action = 'submission.recorded'
      ORDER BY created_at`,
    )) as unknown as Array<Record<string, string>>

    if (!submissions.length) return null

    const prompt = `Assess exam integrity risk for this candidate based on their submission behavior:
${JSON.stringify(submissions)}

Return JSON: {
  "candidateId": "${candidateId}",
  "riskScore": number (0-1, where 1 = highest risk),
  "factors": [{ "type": string, "description": string, "severity": "low"|"medium"|"high" }],
  "recommendation": "proceed"|"review"|"flag"
}`

    const { content: raw, execution } = await runAICompletionDetailed(prompt, {
      orgId: ctx.orgId,
      profile: 'nacp-exams-integrity',
      dataClass: 'sensitive',
    })

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : 0
      return buildCanonicalAiOutput({
        payload: {
          candidateId: typeof parsed.candidateId === 'string' ? parsed.candidateId : candidateId,
          riskScore,
          factors: Array.isArray(parsed.factors) ? parsed.factors as IntegrityRisk['factors'] : [],
          recommendation: (parsed.recommendation as IntegrityRisk['recommendation']) ?? 'review',
        },
        appKey: 'nacp-exams',
        orgId: ctx.orgId,
        execution,
        confidenceScore: riskScore,
        evidenceRefs: ['audit_log:submission.recorded', 'ai-profile:nacp-exams-integrity'],
        reviewRequired: true,
        domain: 'education',
      })
    } catch {
      return null
    }
  } catch (error) {
    logger.error('Integrity risk assessment failed', { error, candidateId })
    return null
  }
}

/* ─── Helpers ─── */

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}
