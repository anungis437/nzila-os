/**
 * What the security dashboard reads, in the organization's own context.
 *
 * security_events and security_posture_checks are tenant tables the runtime role reads inside withRLSContext({ organizationId }); the system
 * role holds no grant on either. A failed read rejects and the caller shows the error state: a security dashboard that answers "no events,
 * a perfect score" when it could not read is worse than one that says it failed.
 */
import { sql } from 'drizzle-orm';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';

export interface SecurityEvent {
  id: string;
  eventType: string;
  severity: string;
  status: string;
  sourceIp: string | null;
  userEmail: string | null;
  description: string;
  resource: string | null;
  actionTaken: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PostureCheck {
  id: string;
  checkName: string;
  category: string;
  status: string;
  score: number | null;
  details: string | null;
  lastCheckedAt: string;
}

type Row = Record<string, unknown>;

async function readSecurityEvents(tx: RLSTx, organizationId: string): Promise<SecurityEvent[]> {
  const result = await tx.execute(sql`
    SELECT id, event_type, severity, status, source_ip, user_email,
           description, resource, action_taken, resolved_by, resolved_at, created_at
    FROM security_events
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY created_at DESC
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
    id: r.id as string,
    eventType: r.event_type as string,
    severity: r.severity as string,
    status: r.status as string,
    sourceIp: r.source_ip as string | null,
    userEmail: r.user_email as string | null,
    description: r.description as string,
    resource: r.resource as string | null,
    actionTaken: r.action_taken as string | null,
    resolvedBy: r.resolved_by as string | null,
    resolvedAt: r.resolved_at as string | null,
    createdAt: r.created_at as string,
  }));
}

async function readPostureChecks(tx: RLSTx, organizationId: string): Promise<PostureCheck[]> {
  const result = await tx.execute(sql`
    SELECT id, check_name, category, status, score, details, last_checked_at
    FROM security_posture_checks
    WHERE organization_id = ${organizationId}::uuid
    ORDER BY
      CASE status WHEN 'fail' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END,
      category
  `);

  return Array.from(result as Iterable<Row>).map((r) => ({
    id: r.id as string,
    checkName: r.check_name as string,
    category: r.category as string,
    status: r.status as string,
    score: r.score === null || r.score === undefined ? null : Number(r.score),
    details: r.details as string | null,
    lastCheckedAt: r.last_checked_at as string,
  }));
}

/** The organization's security events and posture checks, in one transaction. Rejects when either cannot be read. */
export function loadSecurityDashboard(organizationId: string): Promise<{ events: SecurityEvent[]; posture: PostureCheck[] }> {
  return withRLSContext({ organizationId }, async (tx) => ({
    events: await readSecurityEvents(tx, organizationId),
    posture: await readPostureChecks(tx, organizationId),
  }));
}
