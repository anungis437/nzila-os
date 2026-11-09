import { and, eq } from 'drizzle-orm';
import { memberJurisdictionPreferences } from '@/db/schema';
import type { RLSTx } from '@/lib/db/with-rls-context';

export interface EffectiveJurisdictionPreference {
  applied: boolean;
  jurisdictions: string[];
  source: 'request_override' | 'member_preference' | 'none';
}

/** Resolve once on the server; request filters intentionally override auto-apply. */
export async function resolvePrecedentJurisdictions(
  tx: RLSTx,
  input: { organizationId: string; userId: string; requestOverride?: string[] },
): Promise<EffectiveJurisdictionPreference> {
  if (input.requestOverride && input.requestOverride.length > 0) {
    return { applied: true, jurisdictions: [...new Set(input.requestOverride)], source: 'request_override' };
  }
  const [row] = await tx.select().from(memberJurisdictionPreferences).where(and(
    eq(memberJurisdictionPreferences.organizationId, input.organizationId),
    eq(memberJurisdictionPreferences.userId, input.userId),
  )).limit(1);
  if (!row?.autoApply) return { applied: false, jurisdictions: [], source: 'none' };

  const selected = new Set(row.preferredJurisdictions ?? []);
  if (row.includeNational || row.preferredLevels?.includes('federal')) selected.add('federal');
  return { applied: selected.size > 0, jurisdictions: [...selected], source: 'member_preference' };
}
