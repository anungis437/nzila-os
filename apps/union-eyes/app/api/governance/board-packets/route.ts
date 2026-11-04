/**
 * GET POST /api/governance/board-packets
 *
 * The organization's board packets. A packet is prepared as a draft by an admin, finalized (certified) and then distributed; see
 * lib/governance/board-packet-lifecycle.ts. The list carries each packet's descriptors and status, not its sections or PDF: those are on the packet itself.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { parseCrudPagination } from '@/lib/api/pagination';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { createBoardPacketSchema } from '@/lib/governance/board-packet-input';
import { createBoardPacket } from '@/lib/governance/board-packet-service';

const statusSchema = z.enum(['draft', 'finalized', 'distributed', 'archived']);

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'List board packets' },
  },
  async ({ request, organizationId }) => {
    const search = new URL(request.url).searchParams;
    const { page, limit, offset } = parseCrudPagination(search, 20);
    const requested = search.get('status');
    const filter = requested === null ? null : statusSchema.safeParse(requested);
    if (filter && !filter.success) throw ApiError.badRequest('status must be draft, finalized, distributed or archived');

    // Archiving is how a packet is deleted, so an archived packet is listed only when it is asked for.
    const scope = and(
      eq(boardPackets.organizationId, organizationId!),
      filter ? eq(boardPackets.status, filter.data) : ne(boardPackets.status, 'archived'),
    );

    const { total, packets } = await withRLSContext({ organizationId: organizationId! }, async (tx) => {
      const [counted] = await tx.select({ total: count() }).from(boardPackets).where(scope);
      const rows = await tx
        .select({
          id: boardPackets.id,
          title: boardPackets.title,
          packetType: boardPackets.packetType,
          periodStart: boardPackets.periodStart,
          periodEnd: boardPackets.periodEnd,
          fiscalYear: boardPackets.fiscalYear,
          fiscalQuarter: boardPackets.fiscalQuarter,
          status: boardPackets.status,
          generatedBy: boardPackets.generatedBy,
          generatedAt: boardPackets.generatedAt,
          finalizedAt: boardPackets.finalizedAt,
          signedBy: boardPackets.signedBy,
          signedAt: boardPackets.signedAt,
          contentHash: boardPackets.contentHash,
          distributedAt: boardPackets.distributedAt,
          recipientRoles: boardPackets.recipientRoles,
          createdAt: boardPackets.createdAt,
          updatedAt: boardPackets.updatedAt,
        })
        .from(boardPackets)
        .where(scope)
        .orderBy(desc(boardPackets.createdAt), desc(boardPackets.id))
        .limit(limit)
        .offset(offset);
      return { total: counted?.total ?? 0, packets: rows };
    });

    return { data: packets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Create board packet' },
  },
  async ({ body, userId, organizationId }) => {
    const packet = createBoardPacketSchema.parse(body);
    // The packet and its audit record commit together. The organization and the preparer are the resolved caller's: a request that names either, or a status,
    // is refused by the schema, so a create cannot mint a packet for another organization, in another person's name or already finalized.
    return withRLSContext({ organizationId: organizationId! }, (tx) =>
      createBoardPacket(tx, { organizationId: organizationId!, userId: userId!, packet }),
    );
  },
);
