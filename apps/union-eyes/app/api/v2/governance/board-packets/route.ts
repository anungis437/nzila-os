/**
 * GET POST /api/v2/governance/board-packets
 * Board packet management backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { desc } from 'drizzle-orm';
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
  { auth: { required: true, minRole: 'officer' } },
  async () => {
    const rows = await db.select().from(boardPackets).orderBy(desc(boardPackets.createdAt)).limit(50);
    return rows;
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body }) => {
    const parsed = createBoardPacketSchema.parse(body);
    const [row] = await db.insert(boardPackets).values(parsed).returning();
    return row;
  },
);
