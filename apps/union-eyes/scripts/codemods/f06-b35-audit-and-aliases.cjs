const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
// 1. a location write is audited in the same transaction, and a refusal is not a 500
edit('services/geofence-privacy-service.ts', [
  [`  static async trackLocation(tracking: LocationTrackingRequest) {`, `  static async trackLocation(tracking: LocationTrackingRequest, tx: RLSTx = db) {`],
  [`    // Record location
    const [location] = await db
      .insert(locationTracking)`, `    // Record location
    const [location] = await tx
      .insert(locationTracking)`],
])
edit('app/api/location/track/route.ts', [
  [`import { withApiAuth, getCurrentUser } from "@/lib/api-auth-guard";`, `import { withApiAuth, getCurrentUser } from "@/lib/api-auth-guard";
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';`],
  [`    // Track location (service will verify consent)
    const location = await GeofencePrivacyService.trackLocation({
      userId: user.id,
      latitude,
      longitude,
      accuracy,
      altitude,
      purpose,
      activityType,
      strikeId,
      eventId,
    });
`, `    // Track location (the service verifies consent). The point and its audit record commit together; the audit names
    // the purpose and the strike or event, never the coordinates.
    const organizationId = await getOrganizationIdForUser(user.id);
    const location = await withRLSContext({ organizationId }, async (tx) => {
      const recorded = await GeofencePrivacyService.trackLocation({
        userId: user.id,
        latitude,
        longitude,
        accuracy,
        altitude,
        purpose,
        activityType,
        strikeId,
        eventId,
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId,
        userId: user.id,
        action: 'location.track.record',
        resourceType: 'location_tracking',
        resourceId: recorded.id,
        details: { purpose, strikeId: strikeId ?? null, eventId: eventId ?? null },
      });
      return recorded;
    });
`],
  [`  } catch (error: any) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to track location" },
      { status: 500 }
    );
  }`, `  } catch (error: unknown) {
    // A refusal for want of consent or because tracking is off is the answer to the request, not a server fault.
    const message = error instanceof Error ? error.message : '';
    if (message.includes('requires explicit opt-in consent')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('globally disabled')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    logger.error('location track failed', { error: message });
    return NextResponse.json({ error: "Failed to track location" }, { status: 500 });
  }`],
])
edit('app/api/__tests__/location-track.route.test.ts', [
  [`vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));`, `vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: vi.fn(async () => 'org-1') }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));`],
  [`  standardSuccessResponse: vi.fn(),
}));`, `  standardSuccessResponse: vi.fn(),
  tx: { marker: 'tx' },
  persistAtomicAudit: vi.fn(),
}));`],
  [`    expect(m.trackLocation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id' }),
    );`, `    expect(m.trackLocation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id' }),
      m.tx,
    );`],
  [`  it('POST returns 401 when unauthenticated', async () => {`, `  // DEF-0B8-JUR-LOCATION-TRACK-WRITES-ARE-UNAUDITED-AND-REFUSALS-ANSWER-500
  it('POST audits the recorded point on the same transaction without the coordinates', async () => {
    const { POST } = await loadRoute();

    await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify({ latitude: 45.5, longitude: -73.6, purpose: 'strike' }),
    }));

    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    const [tx, record] = m.persistAtomicAudit.mock.calls[0]!;
    expect(tx).toBe(m.tx);
    expect(record).toMatchObject({ organizationId: 'org-1', userId: 'caller-own-id', action: 'location.track.record', resourceId: 'location_1' });
    expect(JSON.stringify(record)).not.toContain('45.5');
  });

  it('POST answers 403, not 500, for a member who has not opted in', async () => {
    const { POST } = await loadRoute();
    m.trackLocation.mockRejectedValueOnce(new Error('Location tracking requires explicit opt-in consent'));

    const response = await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify({ latitude: 45.5, longitude: -73.6, purpose: 'strike' }),
    }));

    expect(response.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST answers 503 while tracking is disabled, and 500 without internal text for any other failure', async () => {
    const { POST } = await loadRoute();
    const request = () => new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify({ latitude: 45.5, longitude: -73.6, purpose: 'strike' }),
    });
    m.trackLocation.mockRejectedValueOnce(new Error('Location tracking is globally disabled'));
    expect((await POST(request())).status).toBe(503);

    m.trackLocation.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('ECONNREFUSED');
  });

  it('POST returns 401 when unauthenticated', async () => {`],
])
// 2. the audit-log read names the columns it returns
edit('app/api/compliance/audit-logs/route.ts', [
  [`      const rows = await tx
        .select()
        .from(auditLogs)`, `      // The record of who did what and when. The captured values, network address, user agent, session and correlation ids,
      // free-form metadata and error text stay in the store and are not served by this list.
      const rows = await tx
        .select({
          auditId: auditLogs.auditId,
          action: auditLogs.action,
          resourceType: auditLogs.resourceType,
          resourceId: auditLogs.resourceId,
          userId: auditLogs.userId,
          severity: auditLogs.severity,
          outcome: auditLogs.outcome,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)`],
])
// 3. investigation names that delegate to unrelated routes answer 501
edit('scripts/codemods/f02-domain-facades-501.cjs', [
  [`  'events/[id]/occurrences':`, `  'investigations': 'an alias of the case collection (no investigation record exists, and a create made a case)',
  'investigations/audit': 'an alias of the organization audit-log list under an investigation name (no investigation audit exists, and it listed the organization audit log)',
  'events/[id]/occurrences':`],
])
edit('lib/api/__tests__/roster-facades.contract.test.ts', [
  [`'communications/templates/[id]/duplicate',`, `'communications/templates/[id]/duplicate', 'investigations', 'investigations/audit',`],
])
console.log('ok')
