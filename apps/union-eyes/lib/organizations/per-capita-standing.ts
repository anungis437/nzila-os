/**
 * Per-capita remittances received by an organization (a congress or federation), read in that organization's own context.
 *
 * per_capita_remittances is a multi-party table: its row-level security lets an organization see the remittances it sends and the ones
 * addressed to it, so no system authority is needed to read what a parent receives. Without a context (the old page read) the runtime role
 * sees none of them.
 *
 * What the dashboards show comes from these rows and nothing else:
 *   - members are each affiliate's remittable members in its latest remittance period, not the sum over every period;
 *   - a remittance is overdue when it is still pending after its due date;
 *   - compliance is the share, by remittances that fell due in the last twelve months, that were submitted on or before their due date;
 *     with nothing that fell due there is no rate, and it is null, never zero;
 *   - revenue is the amount of this calendar year's approved and paid remittances.
 */
import { and, eq, gte, sql } from 'drizzle-orm';
import { perCapitaRemittances } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';

export interface RemittanceFact {
  fromOrganizationId: string;
  remittanceYear: number;
  remittanceMonth: number;
  status: string | null;
  remittableMembers: number;
  totalAmount: string;
  submittedAt: string | null;
  overdue: boolean;
  fellDueInLastYear: boolean;
  submittedOnTime: boolean;
  inCurrentYear: boolean;
}

export interface RemittanceMetrics {
  totalMembers: number;
  pendingRemittances: number;
  overdueRemittances: number;
  /** Whole percent, or null when no remittance fell due in the last twelve months. */
  complianceRate: number | null;
  totalRevenue: number;
}

export type RemittanceStanding = 'current' | 'pending' | 'overdue';
export type ComplianceStanding = 'compliant' | 'at-risk' | 'non-compliant';

export interface AffiliateStanding {
  remittanceStatus: RemittanceStanding;
  complianceStatus: ComplianceStanding;
  lastRemittanceDate: string | null;
}

const isLater = (a: RemittanceFact, b: RemittanceFact) =>
  a.remittanceYear !== b.remittanceYear ? a.remittanceYear > b.remittanceYear : a.remittanceMonth > b.remittanceMonth;

export function summarizeRemittances(facts: readonly RemittanceFact[]): RemittanceMetrics {
  const latest = new Map<string, RemittanceFact>();
  for (const fact of facts) {
    const known = latest.get(fact.fromOrganizationId);
    if (!known || isLater(fact, known)) latest.set(fact.fromOrganizationId, fact);
  }
  const fellDue = facts.filter((fact) => fact.fellDueInLastYear);
  return {
    totalMembers: [...latest.values()].reduce((sum, fact) => sum + fact.remittableMembers, 0),
    pendingRemittances: facts.filter((fact) => fact.status === 'pending').length,
    overdueRemittances: facts.filter((fact) => fact.overdue).length,
    complianceRate: fellDue.length === 0 ? null : Math.round((fellDue.filter((fact) => fact.submittedOnTime).length / fellDue.length) * 100),
    totalRevenue: facts
      .filter((fact) => fact.inCurrentYear && (fact.status === 'approved' || fact.status === 'paid'))
      .reduce((sum, fact) => sum + Number(fact.totalAmount), 0),
  };
}

/**
 * Where each affiliate stands with the organization it remits to. An affiliate that has remitted nothing is not "current" and not
 * "compliant": nothing on file is reported as pending and at risk.
 */
export function standingOf(facts: readonly RemittanceFact[]): AffiliateStanding {
  if (facts.length === 0) return { remittanceStatus: 'pending', complianceStatus: 'at-risk', lastRemittanceDate: null };
  const overdue = facts.some((fact) => fact.overdue);
  const pending = facts.some((fact) => fact.status === 'pending');
  const submitted = facts.map((fact) => fact.submittedAt).filter((value): value is string => !!value).sort();
  return {
    remittanceStatus: overdue ? 'overdue' : pending ? 'pending' : 'current',
    complianceStatus: overdue ? 'non-compliant' : pending ? 'at-risk' : 'compliant',
    lastRemittanceDate: submitted.length > 0 ? submitted[submitted.length - 1] : null,
  };
}

/** The remittances addressed to the organization from this calendar year and the one before, as facts. */
export function loadRemittanceFacts(organizationId: string): Promise<RemittanceFact[]> {
  return withRLSContext({ organizationId }, (tx) =>
    tx
      .select({
        fromOrganizationId: perCapitaRemittances.fromOrganizationId,
        remittanceYear: perCapitaRemittances.remittanceYear,
        remittanceMonth: perCapitaRemittances.remittanceMonth,
        status: perCapitaRemittances.status,
        remittableMembers: perCapitaRemittances.remittableMembers,
        totalAmount: perCapitaRemittances.totalAmount,
        submittedAt: perCapitaRemittances.submittedDate,
        overdue: sql<boolean>`(${perCapitaRemittances.status} = 'pending' AND ${perCapitaRemittances.dueDate} < CURRENT_DATE)`,
        fellDueInLastYear: sql<boolean>`(${perCapitaRemittances.dueDate} <= CURRENT_DATE AND ${perCapitaRemittances.dueDate} >= CURRENT_DATE - INTERVAL '12 months')`,
        submittedOnTime: sql<boolean>`(${perCapitaRemittances.submittedDate} IS NOT NULL AND ${perCapitaRemittances.submittedDate}::date <= ${perCapitaRemittances.dueDate})`,
        inCurrentYear: sql<boolean>`(${perCapitaRemittances.remittanceYear} = EXTRACT(YEAR FROM CURRENT_DATE))`,
      })
      .from(perCapitaRemittances)
      .where(
        and(
          eq(perCapitaRemittances.toOrganizationId, organizationId),
          gte(perCapitaRemittances.remittanceYear, sql`(EXTRACT(YEAR FROM CURRENT_DATE)::int - 1)`),
        ),
      ),
  );
}

export async function loadRemittanceMetrics(organizationId: string): Promise<RemittanceMetrics> {
  return summarizeRemittances(await loadRemittanceFacts(organizationId));
}

/** The standing of each of the organization's affiliates, keyed by the affiliate's organization id; an affiliate absent from the map has remitted nothing. */
export async function loadAffiliateStandings(organizationId: string): Promise<Map<string, AffiliateStanding>> {
  const facts = await loadRemittanceFacts(organizationId);
  const byAffiliate = new Map<string, RemittanceFact[]>();
  for (const fact of facts) byAffiliate.set(fact.fromOrganizationId, [...(byAffiliate.get(fact.fromOrganizationId) ?? []), fact]);
  return new Map([...byAffiliate].map(([affiliateId, rows]) => [affiliateId, standingOf(rows)]));
}
