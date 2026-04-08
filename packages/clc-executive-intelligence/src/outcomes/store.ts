/**
 * CLC Executive Intelligence — Decision Outcome Store
 *
 * In-memory, org-scoped store for decision outcomes.
 * This is a library-level abstraction — consumers (API routes, apps)
 * can provide a persistence adapter for database-backed storage.
 *
 * Design:
 * - Organization-scoped for multi-tenant isolation
 * - CRUD operations with validation
 * - Time-window filtering for metrics computation
 * - Immutable after recording (outcomes cannot be edited, only appended)
 *
 * @module outcomes/store
 */

import type {
  DecisionOutcome,
  DecisionOutcomeResult,
} from '../contracts/index';

// ── Validation ──────────────────────────────────────────────────────────────

const VALID_OUTCOMES: ReadonlySet<DecisionOutcomeResult> = new Set(['success', 'partial', 'failure']);

export interface OutcomeValidationError {
  field: string;
  message: string;
}

/**
 * Validate a decision outcome before recording.
 */
export function validateOutcome(outcome: DecisionOutcome): OutcomeValidationError[] {
  const errors: OutcomeValidationError[] = [];

  if (!outcome.priorityId || outcome.priorityId.trim() === '') {
    errors.push({ field: 'priorityId', message: 'priorityId is required' });
  }
  if (!outcome.recommendedAction || outcome.recommendedAction.trim() === '') {
    errors.push({ field: 'recommendedAction', message: 'recommendedAction is required' });
  }
  if (!outcome.actionTaken || outcome.actionTaken.trim() === '') {
    errors.push({ field: 'actionTaken', message: 'actionTaken is required' });
  }
  if (!VALID_OUTCOMES.has(outcome.outcome)) {
    errors.push({ field: 'outcome', message: `outcome must be one of: ${[...VALID_OUTCOMES].join(', ')}` });
  }
  if (typeof outcome.successScore !== 'number' || outcome.successScore < 0 || outcome.successScore > 1) {
    errors.push({ field: 'successScore', message: 'successScore must be a number between 0 and 1' });
  }
  if (!outcome.createdAt || outcome.createdAt.trim() === '') {
    errors.push({ field: 'createdAt', message: 'createdAt is required' });
  }

  return errors;
}

// ── In-Memory Store ─────────────────────────────────────────────────────────

/**
 * In-memory decision outcome store with org-scoped isolation.
 *
 * For production use, consumers should implement a PersistenceAdapter
 * that persists to database and delegates reads accordingly.
 */
export class DecisionOutcomeStore {
  private readonly outcomes: Map<string, DecisionOutcome[]> = new Map();
  private idCounter = 0;

  /**
   * Record a new decision outcome.
   * Returns the outcome with a generated ID if none was provided.
   */
  recordOutcome(outcome: DecisionOutcome, organizationId?: string): DecisionOutcome {
    const errors = validateOutcome(outcome);
    if (errors.length > 0) {
      throw new Error(`Invalid outcome: ${errors.map((e) => e.message).join('; ')}`);
    }

    const orgKey = organizationId ?? outcome.organizationId ?? '_default';
    const stored: DecisionOutcome = {
      ...outcome,
      id: outcome.id ?? `outcome-${++this.idCounter}`,
      organizationId: orgKey === '_default' ? undefined : orgKey,
    };

    const existing = this.outcomes.get(orgKey);
    if (existing) {
      existing.push(stored);
    } else {
      this.outcomes.set(orgKey, [stored]);
    }

    return stored;
  }

  /**
   * Get all outcomes for an organization.
   */
  getOutcomes(organizationId?: string): DecisionOutcome[] {
    const orgKey = organizationId ?? '_default';
    return [...(this.outcomes.get(orgKey) ?? [])];
  }

  /**
   * Get outcomes within a time window.
   */
  getOutcomesInWindow(
    windowStart: string,
    windowEnd: string,
    organizationId?: string,
  ): DecisionOutcome[] {
    const all = this.getOutcomes(organizationId);
    const startTime = new Date(windowStart).getTime();
    const endTime = new Date(windowEnd).getTime();

    return all.filter((o) => {
      const created = new Date(o.createdAt).getTime();
      return created >= startTime && created <= endTime;
    });
  }

  /**
   * Get outcomes by priority ID.
   */
  getOutcomesByPriority(priorityId: string, organizationId?: string): DecisionOutcome[] {
    return this.getOutcomes(organizationId).filter((o) => o.priorityId === priorityId);
  }

  /**
   * Get outcomes by action type.
   */
  getOutcomesByAction(actionType: string, organizationId?: string): DecisionOutcome[] {
    return this.getOutcomes(organizationId).filter((o) => o.recommendedAction === actionType);
  }

  /**
   * Get total outcome count across all organizations.
   */
  getTotalCount(): number {
    let total = 0;
    for (const outcomes of this.outcomes.values()) {
      total += outcomes.length;
    }
    return total;
  }

  /**
   * Clear all outcomes (for testing).
   */
  clear(): void {
    this.outcomes.clear();
    this.idCounter = 0;
  }
}
