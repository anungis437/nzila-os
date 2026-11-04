/**
 * POST /api/chatbot/sessions/[sessionId]/archive
 *
 * Archives one of the caller's own chat sessions: its status moves from active to archived, which takes it out of the active list
 * (GET /api/chatbot/sessions). Nothing is deleted and the transcript is kept. A session that is another member's, that belongs to another
 * organization or that does not exist is answered as not found, so the route does not say which sessions exist.
 */
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { chatSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    requireOrg: true,
    entitlement: 'ai_advanced_insights',
    openapi: { tags: ['AI'], summary: 'Archive one of the caller\'s own chat sessions' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Chat session context required');
    const parsed = zUUID.safeParse(params.sessionId);
    if (!parsed.success) throw ApiError.notFound('Chat session');
    const sessionId = parsed.data;

    // The status change and its audit record commit together. The owner is the resolved caller, never anything the client sent.
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const owned = and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.organizationId, organizationId),
        eq(chatSessions.userId, userId),
      );
      const [session] = await tx
        .select({ id: chatSessions.id, status: chatSessions.status })
        .from(chatSessions)
        .where(owned)
        .limit(1);
      if (!session || session.status === 'deleted') throw ApiError.notFound('Chat session');
      // Archiving an archived session is not an error and changes nothing, so it writes and audits nothing.
      if (session.status === 'archived') return { data: { id: session.id, status: 'archived' as const } };

      const [archived] = await tx
        .update(chatSessions)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(
          and(
            eq(chatSessions.id, sessionId),
            eq(chatSessions.organizationId, organizationId),
            eq(chatSessions.userId, userId),
            eq(chatSessions.status, 'active'),
          ),
        )
        .returning({ id: chatSessions.id, status: chatSessions.status });
      if (!archived) {
        // A concurrent request archived it first (the status predicate held this one back until that commit): the state asked for holds, and that request wrote the audit record.
        const [current] = await tx.select({ id: chatSessions.id, status: chatSessions.status }).from(chatSessions).where(owned).limit(1);
        if (current?.status === 'archived') return { data: { id: current.id, status: 'archived' as const } };
        throw ApiError.conflict('Chat session changed');
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'chatbot.session.archive',
        resourceType: 'chat_sessions',
        resourceId: sessionId,
        details: { from: 'active', to: 'archived' },
      });
      return { data: archived };
    });
  },
);
