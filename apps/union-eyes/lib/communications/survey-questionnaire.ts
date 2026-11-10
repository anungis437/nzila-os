import { createHash, createHmac } from 'node:crypto';
import type { SurveyQuestionSnapshot } from '@/db/schema/domains/communications/surveys';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

export function questionnaireDigest(questions: SurveyQuestionSnapshot[]): string {
  return createHash('sha256').update(JSON.stringify(canonical(questions))).digest('hex');
}

export function anonymousParticipationDigest(surveyId: string, userId: string): string | null {
  const key = process.env.SURVEY_PARTICIPATION_HMAC_KEY;
  if (!key || key.length < 32) return null;
  return createHmac('sha256', key).update(`${surveyId}\0${userId}`).digest('hex');
}
