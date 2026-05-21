/**
 * ARTIFACT TYPE: Intelligence Registry
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity Intelligence Registry.
 *
 * The registry holds opt-in participation grants for institutions choosing to
 * contribute longitudinal continuity readings to the network. The registry is
 * the gate every aggregation pipeline must clear before reading a record.
 *
 * Posture:
 *   - Opt-in only. The registry never holds an "implicit" participant.
 *   - Per-scope. Granting one scope (e.g. governance drift) does NOT imply
 *     consent for another (e.g. stewardship evolution).
 *   - Withdrawable. Withdrawal removes the institution from future reads. The
 *     registry never asserts historical aggregations were wrong; it simply
 *     stops including the institution from the withdrawal timestamp onward.
 */

import type {
  IntelligenceParticipationGrant,
  IntelligenceSector,
  ParticipationScope,
} from '../contracts/intelligenceContracts';

export const INTELLIGENCE_REGISTRY_VERSION = '1.0.0' as const;

export interface RegistryWithdrawal {
  readonly institutionRefHash: string;
  readonly withdrawnAt: string; // ISO-8601
  readonly reviewerRefId: string;
}

export interface ContinuityIntelligenceRegistry {
  grant(grant: IntelligenceParticipationGrant): void;
  withdraw(withdrawal: RegistryWithdrawal): void;
  listActiveGrants(sector?: IntelligenceSector): ReadonlyArray<IntelligenceParticipationGrant>;
  isOptedIn(institutionRefHash: string, scope: ParticipationScope): boolean;
}

interface InternalRecord {
  readonly grant: IntelligenceParticipationGrant;
  withdrawnAt?: string;
}

/**
 * In-memory registry. Production deployments back this with the institution's
 * own governance ledger; the engine is storage-agnostic.
 */
export function createContinuityIntelligenceRegistry(): ContinuityIntelligenceRegistry {
  const records = new Map<string, InternalRecord>();

  return {
    grant(grant) {
      // Reject empty or malformed grants. We refuse rather than coerce.
      if (!grant.institutionRefHash || grant.grantedScopes.length === 0) {
        return;
      }
      records.set(grant.institutionRefHash, { grant });
    },

    withdraw(withdrawal) {
      const existing = records.get(withdrawal.institutionRefHash);
      if (!existing) {
        return;
      }
      records.set(withdrawal.institutionRefHash, {
        grant: existing.grant,
        withdrawnAt: withdrawal.withdrawnAt,
      });
    },

    listActiveGrants(sector) {
      const active: IntelligenceParticipationGrant[] = [];
      for (const record of records.values()) {
        if (record.withdrawnAt) continue;
        if (sector && record.grant.sector !== sector) continue;
        active.push(record.grant);
      }
      // Deterministic ordering by institutionRefHash so downstream reads stay
      // stable across runs.
      return active.sort((a, b) =>
        a.institutionRefHash.localeCompare(b.institutionRefHash),
      );
    },

    isOptedIn(institutionRefHash, scope) {
      const record = records.get(institutionRefHash);
      if (!record || record.withdrawnAt) return false;
      return record.grant.grantedScopes.includes(scope);
    },
  };
}
