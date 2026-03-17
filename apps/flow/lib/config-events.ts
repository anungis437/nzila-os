/**
 * Flow — Org Config Change Events
 *
 * Wires OrgConfigChangeEvent from the service layer to the
 * platform event bus. Evaluates sensitive field changes and
 * records policy audit events when governance-relevant fields
 * are mutated.
 */
import { PlatformEventBus, createPlatformEvent } from '@nzila/platform-events/bus'
import {
  getEventType,
  getSensitiveFields,
  type OrgConfigEventType,
} from '@nzila/platform-commerce-org/audit'
import type { OrgConfigChangeEvent } from '@nzila/platform-commerce-org/types'
import { logger } from '@/lib/logger'

// ── Singleton bus ───────────────────────────────────────────────────────────

let busInstance: PlatformEventBus | undefined

function getBus(): PlatformEventBus {
  if (!busInstance) {
    busInstance = new PlatformEventBus()
  }
  return busInstance
}

/** Expose bus for subscriber registration in app initialisation. */
export function getConfigEventBus(): PlatformEventBus {
  return getBus()
}

// ── Diff helper ─────────────────────────────────────────────────────────────

function changedFieldNames(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(next)])
  const changed: string[] = []
  for (const key of allKeys) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      changed.push(key)
    }
  }
  return changed
}

// ── Emit ────────────────────────────────────────────────────────────────────

/**
 * Emit an org config change event to the platform bus.
 *
 * - Always emits the typed event (e.g. `org_payment_policy_updated`).
 * - If any changed fields are governance-sensitive, emits an additional
 *   `org_config_sensitive_change` event with the sensitivity details.
 */
export function emitConfigChange(changeEvent: OrgConfigChangeEvent): void {
  const bus = getBus()
  const eventType: OrgConfigEventType = getEventType(changeEvent.configType)

  const changedFields = changedFieldNames(
    (changeEvent.previousValue ?? {}) as Record<string, unknown>,
    (changeEvent.newValue ?? {}) as Record<string, unknown>,
  )

  // Primary config-change event
  const platformEvent = createPlatformEvent(
    eventType,
    {
      configType: changeEvent.configType,
      changedFields,
      previousValue: changeEvent.previousValue,
      newValue: changeEvent.newValue,
    },
    {
      orgId: changeEvent.orgId,
      actorId: changeEvent.actorId,
      correlationId: crypto.randomUUID(),
      source: 'flow',
    },
  )
  bus.emit(platformEvent)

  // Sensitive-field governance event
  const sensitiveChecks = getSensitiveFields(changedFields)
  if (sensitiveChecks.length > 0) {
    const sensitiveEvent = createPlatformEvent(
      'org_config_sensitive_change',
      {
        configType: changeEvent.configType,
        sensitiveFields: sensitiveChecks,
        changedFields,
        actorId: changeEvent.actorId,
      },
      {
        orgId: changeEvent.orgId,
        actorId: changeEvent.actorId,
        correlationId: platformEvent.metadata.correlationId,
        source: 'flow',
      },
    )
    bus.emit(sensitiveEvent)

    logger.warn('Sensitive org config fields changed', {
      orgId: changeEvent.orgId,
      configType: changeEvent.configType,
      sensitiveFields: sensitiveChecks.map((s) => s.field),
      actorId: changeEvent.actorId,
    })
  }
}
