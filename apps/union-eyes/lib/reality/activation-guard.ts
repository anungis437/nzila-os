/**
 * Turning on a configuration that nothing consumes.
 *
 * "Enabled" and "auto-provision" are statements that the platform will act on a configuration. While no runtime consumer exists
 * (lib/reality/configuration-effect.ts, `inEffect: false`) setting either to true would store a claim the platform cannot keep, and every
 * response and audit row would then describe a provider or integration as active. Storing the configuration stays possible, switching it
 * off stays possible, and switching it on is refused as the one specific blocked operation the effect names, with the refusal recorded
 * durably so the attempt is visible. When a consumer ships, `inEffect` flips and this guard stops refusing without any change here.
 */
import { ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { ConfigurationEffect } from './configuration-effect';

/** The names among `keys` that the request sets to true. */
export function requestedActivation(requested: Record<string, unknown>, keys: readonly string[]): string[] {
  return keys.filter((key) => requested[key] === true);
}

export function activationRefusal(effect: ConfigurationEffect, asked: readonly string[]): ApiError {
  const needs = effect.blockedOperation.requires.map((item) => `- ${item}`).join('\n');
  return ApiError.conflict(
    `${asked.join(' and ')} cannot be turned on: ${effect.blockedOperation.operation} is not available in this release.\n${effect.notice}\nIt needs:\n${needs}`,
    { blockedOperation: effect.blockedOperation, requested: asked },
  );
}

/**
 * Refuses a request that turns on something the platform cannot act on, after recording the attempt in its own transaction (the refusal
 * rolls the request back, so the record must not depend on it). A request that asks for nothing to be turned on passes through.
 */
export async function refuseUnavailableActivation(input: {
  effect: ConfigurationEffect;
  asked: readonly string[];
  organizationId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
}): Promise<void> {
  if (input.effect.inEffect || input.asked.length === 0) return;
  await withRLSContext({ organizationId: input.organizationId, userId: input.userId }, (tx) =>
    persistAtomicAudit(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: { blockedOperation: input.effect.blockedOperation.operation, capability: input.effect.capability, requested: [...input.asked] },
    }, 'failure'),
  );
  throw activationRefusal(input.effect, input.asked);
}
