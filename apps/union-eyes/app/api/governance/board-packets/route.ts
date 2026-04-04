/**
 * GET POST /api/governance/board-packets
 * Board packet management — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { desc, count } from 'drizzle-orm';
import { z } from 'zod';

const createBoardPacketSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  packetType: z.string().min(1).max(50),
  organizationId: z.string().uuid(),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
  fiscalQuarter: z.number().int().min(1).max(4).optional(),
  generatedBy: z.string().min(1).max(255),
  status: z.enum(['draft', 'finalized', 'distributed', 'archived']).default('draft'),
  financialSummary: z.record(z.unknown()),
  membershipStats: z.record(z.unknown()),
  caseSummary: z.record(z.unknown()),
  motionsAndVotes: z.record(z.unknown()).optional(),
  auditExceptions: z.record(z.unknown()).optional(),
  complianceStatus: z.record(z.unknown()),
  actionItems: z.record(z.unknown()).optional(),
  recipientRoles: z.array(z.string().max(100)),
  distributionList: z.record(z.unknown()).optional(),
  pdfUrl: z.string().url().max(2000).optional(),
  attachments: z.record(z.unknown()).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'List board packets' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const [_totalResult, packets] = await Promise.all([
      db.select({ total: count() }).from(boardPackets),
      db.select().from(boardPackets).orderBy(desc(boardPackets.createdAt)).limit(limit).offset(offset),
    ]);

    return packets;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Create board packet' },
  },
  async ({ body }) => {
    const parsed = createBoardPacketSchema.parse(body);
    const [packet] = await withRLSContext(async () =>
      db.insert(boardPackets).values(parsed).returning()
    );
    return packet;
  },
);

