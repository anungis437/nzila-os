/**
 * @nzila/ai-core — LLM Evaluation Framework
 */

import { randomUUID } from 'node:crypto'

export interface LlmEvalCase {
  id: string
  prompt: string
  expectedSignals: string[]
  forbiddenSignals?: string[]
  referenceAnswer?: string
}

export interface LlmEvalOutput {
  caseId: string
  answer: string
  latencyMs?: number
  tokensIn?: number
  tokensOut?: number
}

export interface LlmEvalCaseResult {
  caseId: string
  score: number
  passed: boolean
  precision: number
  recall: number
  hallucinationRisk: number
  rationale: string
}

export interface LlmEvalRun {
  id: string
  startedAt: string
  finishedAt: string
  averageScore: number
  passRate: number
  regressionDetected: boolean
  results: LlmEvalCaseResult[]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1)
}

function tokenOverlapScore(a: string, b: string): number {
  const left = new Set(tokenize(a))
  const right = new Set(tokenize(b))
  if (left.size === 0 || right.size === 0) return 0

  let overlap = 0
  for (const token of left) {
    if (right.has(token)) overlap += 1
  }
  return overlap / Math.max(left.size, right.size)
}

export function evaluateLlmCase(params: {
  testCase: LlmEvalCase
  output: LlmEvalOutput
}): LlmEvalCaseResult {
  const answer = params.output.answer.toLowerCase()
  const required = params.testCase.expectedSignals
  const forbidden = params.testCase.forbiddenSignals ?? []

  const requiredHits = required.filter((signal) => answer.includes(signal.toLowerCase())).length
  const forbiddenHits = forbidden.filter((signal) => answer.includes(signal.toLowerCase())).length

  const recall = required.length > 0 ? requiredHits / required.length : 1
  const precision = 1 - Math.min(1, forbiddenHits / Math.max(1, requiredHits + forbiddenHits))
  const hallucinationRisk = forbidden.length > 0 ? forbiddenHits / forbidden.length : 0

  const semanticAlignment = params.testCase.referenceAnswer
    ? tokenOverlapScore(params.testCase.referenceAnswer, params.output.answer)
    : 0.8

  const score = Math.max(
    0,
    Math.min(
      1,
      recall * 0.35 + precision * 0.25 + semanticAlignment * 0.3 + (1 - hallucinationRisk) * 0.1,
    ),
  )

  return {
    caseId: params.testCase.id,
    score,
    passed: score >= 0.7,
    precision,
    recall,
    hallucinationRisk,
    rationale: `required=${requiredHits}/${required.length}, forbidden=${forbiddenHits}/${forbidden.length}, alignment=${semanticAlignment.toFixed(2)}`,
  }
}

export function runLlmEvaluation(params: {
  cases: LlmEvalCase[]
  outputs: LlmEvalOutput[]
  previousAverageScore?: number
  regressionThreshold?: number
}): LlmEvalRun {
  const startedAt = new Date().toISOString()
  const outputByCase = new Map(params.outputs.map((output) => [output.caseId, output]))

  const results: LlmEvalCaseResult[] = params.cases.map((testCase) => {
    const output = outputByCase.get(testCase.id)
    if (!output) {
      return {
        caseId: testCase.id,
        score: 0,
        passed: false,
        precision: 0,
        recall: 0,
        hallucinationRisk: 1,
        rationale: 'Missing output for evaluation case',
      }
    }

    return evaluateLlmCase({ testCase, output })
  })

  const averageScore =
    results.length > 0
      ? results.reduce((sum, result) => sum + result.score, 0) / results.length
      : 0
  const passRate = results.length > 0
    ? results.filter((result) => result.passed).length / results.length
    : 0

  const threshold = params.regressionThreshold ?? 0.03
  const regressionDetected =
    typeof params.previousAverageScore === 'number'
      ? averageScore < params.previousAverageScore - threshold
      : false

  return {
    id: randomUUID(),
    startedAt,
    finishedAt: new Date().toISOString(),
    averageScore,
    passRate,
    regressionDetected,
    results,
  }
}
