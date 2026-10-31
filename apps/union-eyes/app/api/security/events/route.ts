/**
 * GET POST /api/security/events
 *
 * Not implemented. This path was configured as a privileged security-manager reader and writer over security_events, but that
 * table is in the denied list of the CRUD governance file, so every caller (a security manager included) was refused by a
 * different rule than the one this file described, and a write path for security evidence was configured that must not exist:
 * a security event is authored by the system, never typed in. The privileged reader of the table is the security dashboard page
 * (security_manager, system context). The path therefore answers 501 and reads and writes nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'security_manager' },
    openapi: {
      tags: ['System'],
      summary: '/api/security/events (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/security/events is not implemented: security events are read on the security dashboard and written only by the system.');
  },
);

export const GET = handler;
export const POST = handler;