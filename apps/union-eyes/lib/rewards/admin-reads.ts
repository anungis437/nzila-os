/**
 * What the rewards administrator pages (member wallets, reports) read, in the organization's own context.
 *
 * recognition_programs, recognition_awards, recognition_award_types, reward_wallet_ledger and organization_members are tenant tables the runtime
 * role reads inside withRLSContext({ organizationId }); the system role holds no grant on the first four. The pages read them as the system
 * role, for an organization id taken from a cookie the browser sends (selected_org_id): an administrator of one organization could name another's
 * and read its members' balances, and a missing cookie read nothing and showed an empty page. The organization now comes from the signed-in
 * administrator's verified membership, a failed read rejects, and the caller shows the error state.
 */
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export type ReportRow = Record<string, unknown>;

export interface RewardsReport {
  stats: ReportRow;
  recent: ReportRow[];
  top: ReportRow[];
}

export interface MemberWalletPage {
  /** How many current members match the search. */
  total: number;
  rows: ReportRow[];
  /** The whole organization, whatever the search or the page: how many members there are, how many hold credits, and how many credits are held. */
  summary: { members: number; withBalance: number; outstanding: number };
}

export const MEMBER_WALLETS_PER_PAGE = 25;

export interface BudgetEnvelopeRow {
  id: string;
  name: string;
  programName: string | null;
  scope: string;
  period: string;
  limit: number;
  used: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const toIso = (value: unknown): string => (value instanceof Date ? value : new Date(String(value))).toISOString();

/** Every budget envelope of the organization, the running ones first, with the program it belongs to. A failed read rejects. */
export function loadBudgetEnvelopes(organizationId: string): Promise<BudgetEnvelopeRow[]> {
  return withRLSContext({ organizationId }, async (tx) => {
    const result = await tx.execute(sql`
      SELECT rbe.id, rbe.name, rp.name AS program_name, rbe.scope_type, rbe.period,
             rbe.amount_limit, rbe.amount_used, rbe.starts_at, rbe.ends_at,
             (NOW() >= rbe.starts_at AND NOW() <= rbe.ends_at) AS is_active
      FROM reward_budget_envelopes rbe
      LEFT JOIN recognition_programs rp ON rp.id = rbe.program_id AND rp.org_id = rbe.org_id
      WHERE rbe.org_id = ${organizationId}::uuid
      ORDER BY is_active DESC, rbe.starts_at DESC, rbe.name
    `);

    return Array.from(result as Iterable<ReportRow>).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      programName: row.program_name == null ? null : String(row.program_name),
      scope: String(row.scope_type),
      period: String(row.period),
      limit: Number(row.amount_limit ?? 0),
      used: Number(row.amount_used ?? 0),
      startsAt: toIso(row.starts_at),
      endsAt: toIso(row.ends_at),
      isActive: row.is_active === true,
    }));
  });
}

/** A page number from the query string: a whole number from 1, anything else is the first page. */
export function parsePageNumber(value: string | undefined): number {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

export function loadRewardsReport(organizationId: string): Promise<RewardsReport> {
  return withRLSContext({ organizationId }, async (tx) => {
    // Overall stats. The recognition tables key an organization as org_id and a person as a user id; the credits an award carries are the credits its ledger entries moved.
    const overall = await tx.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM recognition_programs WHERE org_id = ${organizationId}::uuid AND status = 'active') AS active_programs,
        (SELECT COUNT(*) FROM recognition_awards WHERE org_id = ${organizationId}::uuid) AS total_awards,
        (SELECT COUNT(*) FROM recognition_awards WHERE org_id = ${organizationId}::uuid AND status = 'issued') AS issued_awards,
        (SELECT COUNT(*) FROM recognition_awards WHERE org_id = ${organizationId}::uuid AND status = 'pending') AS pending_awards,
        (SELECT COUNT(*) FROM recognition_awards WHERE org_id = ${organizationId}::uuid AND created_at > NOW() - INTERVAL '30 days') AS awards_last_30_days,
        (SELECT COALESCE(SUM(amount_credits), 0) FROM reward_wallet_ledger WHERE org_id = ${organizationId}::uuid AND source_type = 'award' AND amount_credits > 0) AS credits_issued,
        (SELECT COUNT(DISTINCT recipient_user_id) FROM recognition_awards WHERE org_id = ${organizationId}::uuid AND status = 'issued') AS unique_recipients,
        (SELECT COUNT(DISTINCT issuer_user_id) FROM recognition_awards WHERE org_id = ${organizationId}::uuid AND status = 'issued') AS unique_givers
    `);

    // Recent awards
    const recent = await tx.execute(sql`
      SELECT
        ra.id,
        ra.status,
        COALESCE((SELECT SUM(wl.amount_credits) FROM reward_wallet_ledger wl WHERE wl.source_type = 'award' AND wl.source_id = ra.id AND wl.amount_credits > 0), 0) AS points_value,
        ra.created_at,
        ra.reason AS message,
        om_r.name AS recipient_name,
        om_n.name AS nominator_name,
        rat.name AS award_type_name
      FROM recognition_awards ra
      LEFT JOIN organization_members om_r ON om_r.user_id = ra.recipient_user_id AND om_r.organization_id = ra.org_id
      LEFT JOIN organization_members om_n ON om_n.user_id = ra.issuer_user_id AND om_n.organization_id = ra.org_id
      LEFT JOIN recognition_award_types rat ON rat.id = ra.award_type_id
      WHERE ra.org_id = ${organizationId}::uuid
      ORDER BY ra.created_at DESC
      LIMIT 10
    `);

    // Top recipients by credits
    const top = await tx.execute(sql`
      SELECT
        om.user_id,
        om.name,
        om.email,
        COUNT(ra.id) AS award_count,
        COALESCE(SUM(credits.amount), 0) AS total_points
      FROM recognition_awards ra
      JOIN organization_members om ON om.user_id = ra.recipient_user_id AND om.organization_id = ra.org_id
      LEFT JOIN LATERAL (
        SELECT SUM(wl.amount_credits) AS amount FROM reward_wallet_ledger wl WHERE wl.source_type = 'award' AND wl.source_id = ra.id AND wl.amount_credits > 0
      ) credits ON TRUE
      WHERE ra.org_id = ${organizationId}::uuid
        AND ra.status = 'issued'
      GROUP BY om.id, om.user_id, om.name, om.email
      ORDER BY total_points DESC
      LIMIT 10
    `);

    return {
      stats: (Array.from(overall as Iterable<ReportRow>)[0] ?? {}) as ReportRow,
      recent: Array.from(recent as Iterable<ReportRow>),
      top: Array.from(top as Iterable<ReportRow>),
    };
  });
}

/** One page of the organization's current members with the balance and the lifetime totals of their wallet. */
export function loadMemberWallets(
  organizationId: string,
  options: { search?: string; page?: number; perPage?: number } = {},
): Promise<MemberWalletPage> {
  const perPage = options.perPage ?? MEMBER_WALLETS_PER_PAGE;
  const offset = ((options.page ?? 1) - 1) * perPage;
  const search = options.search?.trim() ?? '';

  return withRLSContext({ organizationId }, async (tx) => {
    const searchFilter = search
      ? sql`AND (om.name ILIKE ${'%' + search + '%'} OR om.email ILIKE ${'%' + search + '%'})`
      : sql``;

    // A member's wallet is its ledger: reward_wallet_ledger records every credit movement with the balance after it, per user and organization.
    const count = await tx.execute(sql`
      SELECT COUNT(DISTINCT om.id) AS total
      FROM organization_members om
      WHERE om.organization_id = ${organizationId}::uuid
        AND om.deleted_at IS NULL
        ${searchFilter}
    `);

    const rows = await tx.execute(sql`
      SELECT
        om.id,
        om.name,
        om.email,
        om.role,
        COALESCE(rw.balance, 0) AS balance,
        COALESCE(rw.lifetime_earned, 0) AS lifetime_earned,
        COALESCE(rw.lifetime_redeemed, 0) AS lifetime_redeemed,
        rw.updated_at AS wallet_updated_at
      FROM organization_members om
      LEFT JOIN LATERAL (
        SELECT
          (SELECT latest.balance_after FROM reward_wallet_ledger latest
            WHERE latest.org_id = om.organization_id AND latest.user_id = om.user_id
            ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1) AS balance,
          SUM(wl.amount_credits) FILTER (WHERE wl.amount_credits > 0) AS lifetime_earned,
          -SUM(wl.amount_credits) FILTER (WHERE wl.amount_credits < 0) AS lifetime_redeemed,
          MAX(wl.created_at) AS updated_at
        FROM reward_wallet_ledger wl
        WHERE wl.org_id = om.organization_id AND wl.user_id = om.user_id
      ) rw ON TRUE
      WHERE om.organization_id = ${organizationId}::uuid
        AND om.deleted_at IS NULL
        ${searchFilter}
      ORDER BY COALESCE(rw.balance, 0) DESC, om.name ASC
      LIMIT ${perPage} OFFSET ${offset}
    `);

    // The organization's figures do not depend on the search or the page shown: a card that says "outstanding credits" is the whole organization's.
    const summary = await tx.execute(sql`
      SELECT
        COUNT(*) AS members,
        COUNT(*) FILTER (WHERE COALESCE(w.balance, 0) > 0) AS with_balance,
        COALESCE(SUM(w.balance), 0) AS outstanding
      FROM organization_members om
      LEFT JOIN LATERAL (
        SELECT latest.balance_after AS balance FROM reward_wallet_ledger latest
        WHERE latest.org_id = om.organization_id AND latest.user_id = om.user_id
        ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1
      ) w ON TRUE
      WHERE om.organization_id = ${organizationId}::uuid
        AND om.deleted_at IS NULL
    `);
    const totals = (Array.from(summary as Iterable<ReportRow>)[0] ?? {}) as ReportRow;

    return {
      total: Number((Array.from(count as Iterable<ReportRow>)[0] as ReportRow | undefined)?.total ?? 0),
      rows: Array.from(rows as Iterable<ReportRow>),
      summary: {
        members: Number(totals.members ?? 0),
        withBalance: Number(totals.with_balance ?? 0),
        outstanding: Number(totals.outstanding ?? 0),
      },
    };
  });
}
