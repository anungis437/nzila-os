/**
 * Internal API client for the council election records served by /api/elections.
 *
 * Only the calls a live screen makes are defined here: a client method nobody uses is a promise the server may not keep.
 * Vote casting and results are deliberately absent. POST /api/elections/{id}/vote answers 501 (no qualified election
 * engine exists) and no results route exists, so no screen may offer either. Add one only together with the route that
 * serves it.
 */

import { z } from 'zod';
import { createClientLogger } from '@/lib/client-logger';

const logger = createClientLogger('api');

/** A request the server answered with an error status. The status lets a screen tell "not permitted" from "broken". */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function readMessage(payload: unknown): string | null {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const { message } = payload;
    if (typeof message === 'string' && message !== '') return message;
  }
  return null;
}

/**
 * Base fetch wrapper with error handling. Every failure is logged and thrown: nothing here turns an error into data.
 */
async function fetchAPI(endpoint: string, init?: RequestInit): Promise<unknown> {
  try {
    // Mutation methods require Idempotency-Key header (enforced by middleware in non-dev)
    const method = (init?.method ?? 'GET').toUpperCase();
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const idempotencyHeaders: Record<string, string> = isMutation
      ? { 'Idempotency-Key': `${endpoint}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}` }
      : {};

    const response = await fetch(endpoint, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...idempotencyHeaders,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      throw new ApiRequestError(
        readMessage(payload) ?? (response.statusText || `HTTP ${response.status}`),
        response.status,
      );
    }

    return await response.json();
  } catch (error) {
    // A refusal or a missing record is an expected answer the screen reports to the person; only a fault is an error event.
    if (error instanceof ApiRequestError && error.status < 500) {
      logger.warn(`API request refused [${endpoint}]`, { status: error.status, message: error.message });
    } else {
      logger.error(`API Error [${endpoint}]:`, error);
    }
    throw error;
  }
}

/**
 * A handler's return value arrives as { success, data, timestamp } and the election routes return their own { data }
 * inside it (the create route returns { data } without the outer envelope). Read through every wrapper to the payload.
 */
function unwrapEnvelope(body: unknown): unknown {
  if (typeof body === 'object' && body !== null && !Array.isArray(body) && 'data' in body) {
    return unwrapEnvelope(body.data);
  }
  return body;
}

/** One row of the global `council_elections` table (db/schema/governance-schema.ts). */
const councilElectionSchema = z.object({
  id: z.string(),
  electionYear: z.number(),
  electionDate: z.string(),
  positionsAvailable: z.number(),
  // Free-form JSON the table documents as [{ name, union, platform, votes }] and [{ name, union, votes, term_start, term_end }].
  candidates: z.array(z.unknown()),
  winners: z.array(z.unknown()),
  totalVotes: z.number(),
  participationRate: z.number().nullish(),
  verifiedBy: z.string().nullish(),
  verificationDate: z.string().nullish(),
  contestedResults: z.boolean().nullish(),
});

export type CouncilElectionRecord = z.infer<typeof councilElectionSchema>;

/** A response that does not have the shape the route promises is an error, never an empty list or a default record. */
function readPayload<T>(schema: z.ZodType<T>, body: unknown, endpoint: string): T {
  const parsed = schema.safeParse(unwrapEnvelope(body));
  if (!parsed.success) {
    logger.error(`API Error [${endpoint}]: unexpected response shape`, parsed.error);
    throw new Error(`Unexpected response from ${endpoint}`);
  }
  return parsed.data;
}

export interface NewCouncilElection {
  electionYear: number;
  electionDate: string;
  positionsAvailable: number;
  candidates: ReadonlyArray<{ name: string; union: string; platform: string }>;
}

export const electionsAPI = {
  list: async (): Promise<CouncilElectionRecord[]> => {
    const body = await fetchAPI('/api/elections');
    return readPayload(z.array(councilElectionSchema), body, '/api/elections');
  },

  get: async (id: string): Promise<CouncilElectionRecord> => {
    const endpoint = `/api/elections/${encodeURIComponent(id)}`;
    const body = await fetchAPI(endpoint);
    return readPayload(councilElectionSchema, body, endpoint);
  },

  /** The route defaults winners to none, total votes to zero and the result to uncontested; none is sent from here. */
  create: async (input: NewCouncilElection): Promise<CouncilElectionRecord> => {
    const body = await fetchAPI('/api/elections', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return readPayload(councilElectionSchema, body, '/api/elections');
  },
};

// Export all APIs as a single object for convenience
export const api = {
  elections: electionsAPI,
};
