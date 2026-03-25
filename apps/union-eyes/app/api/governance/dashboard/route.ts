/**
 * GET /api/governance/dashboard
 * Aggregates golden-share status, reserved-matter votes, mission audits,
 * governance events, and summary stats from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async () => {
    return withSystemContext(async () => {
    // Golden share (latest)
    const gsRows = await db.execute(sql`
      SELECT id, certificate_number, issue_date, share_class, holder_type,
             council_members, status, sunset_clause_active,
             sunset_clause_duration, consecutive_compliance_years, sunset_triggered_date
      FROM golden_shares ORDER BY created_at DESC LIMIT 1
    `);
    const gs = Array.from(gsRows)[0] as Record<string, unknown> | undefined;

    const goldenShare = gs
      ? {
          share: { certificateNumber: gs.certificate_number as string },
          sunsetProgress: {
            consecutiveYears: Number(gs.consecutive_compliance_years ?? 0),
            requiredYears: Number(gs.sunset_clause_duration ?? 5),
            percentComplete: gs.sunset_clause_duration
              ? Math.round(
                  (Number(gs.consecutive_compliance_years ?? 0) /
                    Number(gs.sunset_clause_duration)) *
                    100,
                )
              : 0,
          },
        }
      : null;

    // Recent votes
    const recentVotesRows = await db.execute(sql`
      SELECT id, title, matter_type, voting_deadline
      FROM reserved_matter_votes ORDER BY created_at DESC LIMIT 10
    `);
    const recentVotes = Array.from(recentVotesRows).map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      matterType: r.matter_type,
      votingDeadline: r.voting_deadline ? String(r.voting_deadline) : undefined,
    }));

    // Pending votes
    const pendingVotesRows = await db.execute(sql`
      SELECT id, title, matter_type, voting_deadline
      FROM reserved_matter_votes
      WHERE status = 'pending'
      ORDER BY voting_deadline ASC NULLS LAST LIMIT 10
    `);
    const pendingVotes = Array.from(pendingVotesRows).map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      matterType: r.matter_type,
      votingDeadline: r.voting_deadline ? String(r.voting_deadline) : undefined,
    }));

    // Recent audits
    const auditRows = await db.execute(sql`
      SELECT id, audit_year, auditor_firm, overall_pass
      FROM mission_audits ORDER BY audit_date DESC LIMIT 10
    `);
    const recentAudits = Array.from(auditRows).map((r: Record<string, unknown>) => ({
      id: r.id,
      auditYear: Number(r.audit_year),
      auditorFirm: r.auditor_firm,
      overallPass: Boolean(r.overall_pass),
    }));

    // Recent governance events
    const eventRows = await db.execute(sql`
      SELECT id, title, event_date FROM governance_events
      ORDER BY event_date DESC LIMIT 10
    `);
    const recentEvents = Array.from(eventRows).map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      eventDate: r.event_date ? String(r.event_date) : '',
    }));

    // Stats
    const statsRows = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM reserved_matter_votes)::int AS total_votes,
        (SELECT count(*) FROM reserved_matter_votes WHERE status = 'approved')::int AS votes_approved,
        (SELECT count(*) FROM reserved_matter_votes WHERE status = 'vetoed')::int AS votes_vetoed,
        (SELECT count(*) FROM mission_audits WHERE overall_pass = true)::int AS audits_passed,
        (SELECT count(*) FROM mission_audits WHERE overall_pass = false)::int AS audits_failed
    `);
    const s = Array.from(statsRows)[0] as Record<string, unknown>;

    return {
        goldenShare,
        recentVotes,
        pendingVotes,
        recentAudits,
        recentEvents,
        stats: {
          totalVotes: Number(s.total_votes ?? 0),
          votesApproved: Number(s.votes_approved ?? 0),
          votesVetoed: Number(s.votes_vetoed ?? 0),
          auditsPassed: Number(s.audits_passed ?? 0),
          auditsFailed: Number(s.audits_failed ?? 0),
        },
      };
    });
  },
);

