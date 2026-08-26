import { createHmac, timingSafeEqual } from 'node:crypto';

export const STAGING_PROOF_SCENARIOS = [
  'schedule-basic',
  'reschedule',
  'cancel',
] as const;

export type StagingProofScenario = (typeof STAGING_PROOF_SCENARIOS)[number];

export const STAGING_PROOF_PROTOCOL_VERSION = 'v1';
export const STAGING_PROOF_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface ProofRequestHeaders {
  timestamp: string | null;
  nonce: string | null;
  signature: string | null;
}

export interface ProofEnvironment {
  TARGET_ENVIRONMENT?: string;
  STAGING_PROOFS_ENABLED?: string;
  UNION_EYES_RUNTIME_ID?: string;
  STAGING_PROOF_SECRET?: string;
}

export type ProofAuthorization =
  | { authorized: true; timestamp: Date; nonce: string }
  | { authorized: false };

export function isAuthorizedStagingProofEnvironment(env: ProofEnvironment): boolean {
  return env.TARGET_ENVIRONMENT === 'staging'
    && env.STAGING_PROOFS_ENABLED === 'true'
    && env.UNION_EYES_RUNTIME_ID === 'union-eyes-staging'
    && Boolean(env.STAGING_PROOF_SECRET);
}

export function isStagingProofScenario(value: string): value is StagingProofScenario {
  return (STAGING_PROOF_SCENARIOS as readonly string[]).includes(value);
}

/**
 * Wire format v1: UTF-8 `v1\n<UTC ISO-8601 milliseconds>\n<nonce>\n<scenario>`.
 * Fields cannot contain newlines because timestamp, nonce, and scenario are
 * constrained before verification.
 */
export function createProofCanonicalMessage(
  timestamp: string,
  nonce: string,
  scenario: StagingProofScenario,
): string {
  return `${STAGING_PROOF_PROTOCOL_VERSION}\n${timestamp}\n${nonce}\n${scenario}`;
}

export function createProofSignature(
  secret: string,
  timestamp: string,
  nonce: string,
  scenario: StagingProofScenario,
): string {
  return createHmac('sha256', secret)
    .update(`${STAGING_PROOF_PROTOCOL_VERSION}\n${timestamp}\n${nonce}\n${scenario}`, 'utf8')
    .digest('hex');
}

export function verifyProofAuthorization(input: {
  env: ProofEnvironment;
  headers: ProofRequestHeaders;
  scenario: string;
  now?: Date;
}): ProofAuthorization {
  if (!isAuthorizedStagingProofEnvironment(input.env) || !isStagingProofScenario(input.scenario)) {
    return { authorized: false };
  }

  const { timestamp, nonce, signature } = input.headers;
  if (!timestamp || !nonce || !signature || !TIMESTAMP_PATTERN.test(timestamp) || !NONCE_PATTERN.test(nonce) || !SIGNATURE_PATTERN.test(signature)) {
    return { authorized: false };
  }

  const requestTime = new Date(timestamp);
  const now = input.now ?? new Date();
  if (Number.isNaN(requestTime.getTime()) || requestTime.toISOString() !== timestamp || Math.abs(now.getTime() - requestTime.getTime()) > STAGING_PROOF_MAX_CLOCK_SKEW_MS) {
    return { authorized: false };
  }

  const expected = createProofSignature(input.env.STAGING_PROOF_SECRET!, timestamp, nonce, input.scenario);
  const supplied = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) {
    return { authorized: false };
  }

  return { authorized: true, timestamp: requestTime, nonce };
}