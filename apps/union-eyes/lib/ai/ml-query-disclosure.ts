import { z } from 'zod';

const SAFE_CONTEXT_KEYS = new Set(['dateFrom', 'dateTo', 'jurisdiction', 'status', 'category', 'limit']);
const DIRECT_IDENTIFIER = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b[0-9a-f]{8}-[0-9a-f-]{27,}\b|\b\d{3}[- .]?\d{3}[- .]?\d{4}\b)/i;

export type MlQueryDisclosureDecision =
  | { allowed: true; policyRef: string; providerOrigin: string; context: Record<string, string | number | boolean> }
  | { allowed: false; status: 403 | 503; reason: string };

/** Engineering mechanism for the institution/provider decision. Without an approved reference, external ML disclosure is disabled. */
export function decideMlQueryDisclosure(input: {
  question: string;
  context?: Record<string, string | number | boolean>;
  serviceUrl?: string;
  policyRef?: string;
}): MlQueryDisclosureDecision {
  const policyRef = input.policyRef?.trim();
  if (!policyRef || policyRef.length < 8) return { allowed: false, status: 503, reason: 'External ML disclosure policy is not activated' };
  let provider: URL;
  try { provider = new URL(input.serviceUrl ?? ''); } catch { return { allowed: false, status: 503, reason: 'External ML provider is not configured' }; }
  if (provider.protocol !== 'https:') return { allowed: false, status: 503, reason: 'External ML provider must use HTTPS' };
  if (DIRECT_IDENTIFIER.test(input.question)) return { allowed: false, status: 403, reason: 'The question contains a direct identifier' };
  const context: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input.context ?? {})) {
    if (!SAFE_CONTEXT_KEYS.has(key)) return { allowed: false, status: 403, reason: `Context field ${key} is not approved for disclosure` };
    if (typeof value === 'string' && DIRECT_IDENTIFIER.test(value)) return { allowed: false, status: 403, reason: `Context field ${key} contains a direct identifier` };
    context[key] = value;
  }
  return { allowed: true, policyRef, providerOrigin: provider.origin, context };
}

export const MlQueryProviderResponse = z.object({
  answer: z.string().max(20_000),
  confidence: z.number().min(0).max(1).optional(),
  sources: z.array(z.string().max(500)).max(50).default([]),
}).strict();
