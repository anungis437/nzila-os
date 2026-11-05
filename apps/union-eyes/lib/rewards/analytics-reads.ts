/**
 * What the rewards analytics page reads, in the administrator's own organization.
 *
 * Every figure is the organization's: each statement is filtered by org_id inside withRLSContext({ organizationId }), the credits of an award
 * are the credits its ledger entries moved (an award type's default amount says what a type is worth, not what was awarded), a person is
 * named from the membership of the same organization, and a redemption that was cancelled or refunded is not a redemption. A table that
 * cannot be read rejects: the page used to turn any failure into a screen of zeros.
 */
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const ANALYTICS_PERIODS = ['7d', '30d', '90d', '1y'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = '30d';

/** The period the query string asks for; anything that is not one of the offered periods is the default. */
export function parseAnalyticsPeriod(value: string | undefined): AnalyticsPeriod {
  return (ANALYTICS_PERIODS as readonly string[]).includes(value ?? '') ? (value as AnalyticsPeriod) : DEFAULT_ANALYTICS_PERIOD;
}

/** The start of a period that ends at `end`. */
export function analyticsPeriodStart(period: AnalyticsPeriod, end: Date): Date {
  const start = new Date(end);
  if (period === '1y') start.setFullYear(start.getFullYear() - 1);
  else start.setDate(start.getDate() - Number.parseInt(period, 10));
  return start;
}

export interface RewardsAnalytics {
  period: AnalyticsPeriod;
  awards: { total: number; issued: number; pending: number; recipients: number; givers: number; creditsAwarded: number };
  redemptions: { total: number; creditsRedeemed: number; fulfilled: number };
  budgets: Array<{ id: string; name: string; programName: string | null; scope: string; limit: number; used: number }>;
  topAwardTypes: Array<{ id: string; name: string; awards: number; credits: number }>;
  topReceivers: Array<{ userId: string; name: string | null; awards: number; credits: number }>;
}

type Row = Record<string, unknown>;

/** The credits the ledger moved for one award: what it was worth to the person, not what its type says. */
const AWARD_CREDITS = sql`
  LEFT JOIN LATERAL (
    SELECT SUM(wl.amount_credits) AS amount FROM reward_wallet_ledger wl
    WHERE wl.award_id = ra.id AND wl.org_id = ra.org_id AND wl.amount_credits > 0
  ) credits ON TRUE
`;

export function loadRewardsAnalytics(organizationId: string, period: AnalyticsPeriod, now: Date = new Date()): Promise<RewardsAnalytics> {
  const to = now.toISOString();
  const from = analyticsPeriodStart(period, now).toISOString();

  return withRLSContext({ organizationId }, async (tx) => {
    const rows = async (query: ReturnType<typeof sql>): Promise<Row[]> => Array.from((await tx.execute(query)) as Iterable<Row>);

    // Awards requested in the period, whatever became of them since.
    const [awards = {}] = await rows(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'issued')::int AS issued,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(DISTINCT recipient_user_id) FILTER (WHERE status = 'issued')::int AS recipients,
        COUNT(DISTINCT issuer_user_id) FILTER (WHERE status = 'issued')::int AS givers
      FROM recognition_awards
      WHERE org_id = ${organizationId}::uuid
        AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz
    `);

    const [ledger = {}] = await rows(sql`
      SELECT COALESCE(SUM(amount_credits), 0)::int AS credits_awarded
      FROM reward_wallet_ledger
      WHERE org_id = ${organizationId}::uuid
        AND award_id IS NOT NULL AND amount_credits > 0
        AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz
    `);

    const [redemptions = {}] = await rows(sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(credits_spent), 0)::int AS credits_redeemed,
        COUNT(*) FILTER (WHERE status = 'fulfilled')::int AS fulfilled
      FROM reward_redemptions
      WHERE org_id = ${organizationId}::uuid
        AND status NOT IN ('cancelled', 'refunded')
        AND created_at >= ${from}::timestamptz AND created_at <= ${to}::timestamptz
    `);

    const budgets = await rows(sql`
      SELECT rbe.id, rbe.name, rp.name AS program_name, rbe.scope_type, rbe.amount_limit AS credit_limit, rbe.amount_used AS credits_used
      FROM reward_budget_envelopes rbe
      LEFT JOIN recognition_programs rp ON rp.id = rbe.program_id AND rp.org_id = rbe.org_id
      WHERE rbe.org_id = ${organizationId}::uuid
        AND rbe.starts_at <= ${to}::timestamptz AND rbe.ends_at >= ${from}::timestamptz
      ORDER BY rbe.amount_used DESC, rbe.name
      LIMIT 10
    `);

    const topAwardTypes = await rows(sql`
      SELECT rat.id, rat.name, COUNT(ra.id)::int AS awards, COALESCE(SUM(credits.amount), 0)::int AS credits
      FROM recognition_awards ra
      JOIN recognition_award_types rat ON rat.id = ra.award_type_id AND rat.org_id = ra.org_id
      ${AWARD_CREDITS}
      WHERE ra.org_id = ${organizationId}::uuid
        AND ra.status = 'issued'
        AND ra.created_at >= ${from}::timestamptz AND ra.created_at <= ${to}::timestamptz
      GROUP BY rat.id, rat.name
      ORDER BY awards DESC, rat.name
      LIMIT 10
    `);

    const topReceivers = await rows(sql`
      SELECT ra.recipient_user_id AS user_id, om.name, COUNT(ra.id)::int AS awards, COALESCE(SUM(credits.amount), 0)::int AS credits
      FROM recognition_awards ra
      LEFT JOIN organization_members om ON om.user_id = ra.recipient_user_id AND om.organization_id = ra.org_id
      ${AWARD_CREDITS}
      WHERE ra.org_id = ${organizationId}::uuid
        AND ra.status = 'issued'
        AND ra.created_at >= ${from}::timestamptz AND ra.created_at <= ${to}::timestamptz
      GROUP BY ra.recipient_user_id, om.name
      ORDER BY awards DESC, credits DESC, om.name
      LIMIT 10
    `);

    return {
      period,
      awards: {
        total: Number(awards.total ?? 0),
        issued: Number(awards.issued ?? 0),
        pending: Number(awards.pending ?? 0),
        recipients: Number(awards.recipients ?? 0),
        givers: Number(awards.givers ?? 0),
        creditsAwarded: Number(ledger.credits_awarded ?? 0),
      },
      redemptions: {
        total: Number(redemptions.total ?? 0),
        creditsRedeemed: Number(redemptions.credits_redeemed ?? 0),
        fulfilled: Number(redemptions.fulfilled ?? 0),
      },
      budgets: budgets.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        programName: row.program_name == null ? null : String(row.program_name),
        scope: String(row.scope_type),
        limit: Number(row.credit_limit ?? 0),
        used: Number(row.credits_used ?? 0),
      })),
      topAwardTypes: topAwardTypes.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        awards: Number(row.awards ?? 0),
        credits: Number(row.credits ?? 0),
      })),
      topReceivers: topReceivers.map((row) => ({
        userId: String(row.user_id),
        name: row.name == null ? null : String(row.name),
        awards: Number(row.awards ?? 0),
        credits: Number(row.credits ?? 0),
      })),
    };
  });
}
