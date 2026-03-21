import { randomUUID } from "node:crypto";
import type { DecisionLogEntry, GovernanceDecision } from "./schemas.js";

// ── Decision Store ──────────────────────────────────────────

export interface DecisionStore {
  record(entry: DecisionLogEntry): void;
  getByActor(actorId: string): DecisionLogEntry[];
  getByResource(resourceType: string): DecisionLogEntry[];
  getByOutcome(outcome: "allow" | "deny"): DecisionLogEntry[];
  getByOrg(orgId: string): DecisionLogEntry[];
  getAll(): DecisionLogEntry[];
}

/**
 * In-memory decision store for development and testing.
 * Production should use a persistent store (DB, event stream).
 */
export class InMemoryDecisionStore implements DecisionStore {
  private readonly entries: DecisionLogEntry[] = [];

  record(entry: DecisionLogEntry): void {
    this.entries.push(Object.freeze(entry));
  }

  getByActor(actorId: string): DecisionLogEntry[] {
    return this.entries.filter((e) => e.request.actor.id === actorId);
  }

  getByResource(resourceType: string): DecisionLogEntry[] {
    return this.entries.filter(
      (e) => e.request.resource.type === resourceType,
    );
  }

  getByOutcome(outcome: "allow" | "deny"): DecisionLogEntry[] {
    return this.entries.filter((e) => e.outcome === outcome);
  }

  getByOrg(orgId: string): DecisionLogEntry[] {
    return this.entries.filter(
      (e) => e.request.actor.orgId === orgId,
    );
  }

  getAll(): DecisionLogEntry[] {
    return [...this.entries];
  }
}

// ── Decision Logger ─────────────────────────────────────────

/**
 * Records every governance decision into a store for auditability.
 */
export class DecisionLogger {
  constructor(
    private readonly store: DecisionStore,
    private readonly policySetId: string,
  ) {}

  log(decision: GovernanceDecision): DecisionLogEntry {
    const entry: DecisionLogEntry = {
      ...decision,
      id: randomUUID(),
      policySetId: this.policySetId,
    };
    this.store.record(entry);
    return entry;
  }
}
