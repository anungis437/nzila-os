/**
 * Employer Remittances Routes
 * Endpoints for managing employer bulk payments and reconciliation
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { db, schema } from '../db';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { RemittanceParser } from '@union-claims/financial';

const router = Router();
type AuthUser = {
  organizationId?: string;
  tenantId?: string;
  userId?: string;
  id?: string;
  role?: string;
};

type TxSummaryRow = {
  id: string;
  memberId: string;
  amount: string | number;
  totalAmount?: string | number;
  status?: string;
  paidDate?: string | null;
  periodStart?: string;
  periodEnd?: string;
};

function getAuthUser(req: Request): AuthUser {
  return (req as unknown as { user?: AuthUser }).user ?? {};
}

const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain', // CSV files often detected as text/plain
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Validation schemas
const createRemittanceSchema = z.object({
  employerId: z.guid(),
  employerName: z.string().min(1).max(255),
  batchNumber: z.string().min(1).max(50),
  billingPeriodStart: z.coerce.date(),
  billingPeriodEnd: z.coerce.date(),
  remittancePeriodStart: z.coerce.date().optional(),
  remittancePeriodEnd: z.coerce.date().optional(),
  totalAmount: z.coerce.number().positive(),
  totalMembers: z.number().int().positive(),
  remittanceDate: z.coerce.date(),
  paymentMethod: z.enum(['check', 'ach', 'wire', 'credit_card']),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

const reconcileSchema = z.object({
  transactionIds: z.array(z.guid()).max(500).refine((ids) => new Set(ids).size === ids.length, 'Duplicate transaction IDs are not allowed').optional(),
  autoMatch: z.boolean().default(true),
});

/**
 * GET /api/remittances
 * List all remittances with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId, tenantId } = getAuthUser(req);
    const scopedOrgId = organizationId ?? tenantId;
    const { employerId, status } = req.query;

    if (!scopedOrgId) {
      return res.status(401).json({ success: false, error: 'Missing organization context' });
    }

    const conditions = [eq(schema.employerRemittances.tenantId, scopedOrgId)];

    if (employerId) {
      conditions.push(eq(schema.employerRemittances.employerId, employerId as string));
    }
    if (status) {
      conditions.push(
        eq(
          schema.employerRemittances.status,
          status as typeof schema.employerRemittances.$inferSelect['status'],
        ),
      );
    }

    const remittances = await db
      .select()
      .from(schema.employerRemittances)
      .where(and(...conditions))
      .orderBy(desc(schema.employerRemittances.remittanceDate))
      .limit(100);

    res.json({
      success: true,
      data: remittances,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/remittances/:id
 * Get single remittance with matched transactions
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId, tenantId } = getAuthUser(req);
    const scopedOrgId = organizationId ?? tenantId;
    const { id } = req.params;

    if (!scopedOrgId) {
      return res.status(401).json({ success: false, error: 'Missing organization context' });
    }

    const [remittance] = await db
      .select()
      .from(schema.employerRemittances)
      .where(
        and(
          eq(schema.employerRemittances.id, id),
          eq(schema.employerRemittances.tenantId, scopedOrgId)
        )
      )
      .limit(1);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        error: 'Remittance not found',
      });
    }

    // Fetch matched transactions - note: remittanceId doesn't exist in schema
    // Would need to add this column or use metadata for tracking
    const transactions: TxSummaryRow[] = [];

    res.json({
      success: true,
      data: {
        remittance,
        matchedTransactions: transactions,
      },
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/remittances
 * Create a new remittance record
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { organizationId, tenantId, role } = getAuthUser(req);
    const scopedOrgId = organizationId ?? tenantId;

    if (!scopedOrgId) {
      return res.status(401).json({ success: false, error: 'Missing organization context' });
    }

    const effectiveRole = role ?? '';
    if (!['admin', 'financial_admin'].includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const validatedData = createRemittanceSchema.parse(req.body);

    // Batch number field doesn't exist in schema - skip duplicate check
    // Could use fileHash or metadata for tracking if needed

    const [remittance] = await db
      .insert(schema.employerRemittances)
      .values({
        tenantId: scopedOrgId,
        employerName: validatedData.employerName,
        employerId: validatedData.employerId,
        remittancePeriodStart: validatedData.remittancePeriodStart || validatedData.billingPeriodStart,
        remittancePeriodEnd: validatedData.remittancePeriodEnd || validatedData.billingPeriodEnd,
        totalAmount: validatedData.totalAmount.toString(),
        memberCount: validatedData.totalMembers || 0,
        remittanceDate: validatedData.remittanceDate,
        status: 'pending',
        notes: validatedData.notes,
        // Store additional data in metadata if needed
        metadata: validatedData.referenceNumber ? { referenceNumber: validatedData.referenceNumber } : {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as typeof schema.employerRemittances.$inferInsert)
      .returning();

    res.status(201).json({
      success: true,
      data: remittance,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/remittances/:id/reconcile
 * Reconcile remittance with dues transactions
 */
router.post('/:id/reconcile', async (req: Request, res: Response) => {
  try {
    const { organizationId, tenantId, userId, id: fallbackUserId, role } = getAuthUser(req);
    const scopedOrgId = organizationId ?? tenantId;
    const { id } = req.params;

    if (!scopedOrgId || !(userId ?? fallbackUserId)) {
      return res.status(401).json({ success: false, error: 'Missing auth context' });
    }

    const effectiveRole = role ?? '';
    if (!['admin', 'financial_admin'].includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const validatedData = reconcileSchema.parse(req.body);

    // Fetch remittance
    const [remittance] = await db
      .select()
      .from(schema.employerRemittances)
      .where(
        and(
          eq(schema.employerRemittances.id, id),
          eq(schema.employerRemittances.tenantId, scopedOrgId)
        )
      )
      .limit(1);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        error: 'Remittance not found',
      });
    }

    if (remittance.reconciliationStatus === 'reconciled') {
      return res.status(400).json({
        success: false,
        error: 'Remittance already reconciled',
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transactionsToMatch: TxSummaryRow[] = [];

    if (validatedData.transactionIds && validatedData.transactionIds.length > 0) {
      // Manual matching with specified transaction IDs
      transactionsToMatch = await db
        .select()
        .from(schema.duesTransactions)
        .where(
          and(
            eq(schema.duesTransactions.organizationId, scopedOrgId),
            sql`${schema.duesTransactions.id} = ANY(${validatedData.transactionIds})`,
            isNull(schema.duesTransactions.paidDate)
          )
        );
    } else if (validatedData.autoMatch) {
      // Auto-match: Find pending transactions for same period
      transactionsToMatch = await db
        .select()
        .from(schema.duesTransactions)
        .where(
          and(
            eq(schema.duesTransactions.organizationId, scopedOrgId),
            eq(schema.duesTransactions.periodStart, remittance.remittancePeriodStart),
            eq(schema.duesTransactions.periodEnd, remittance.remittancePeriodEnd),
            isNull(schema.duesTransactions.paidDate)
          )
        );
    }

    if (validatedData.transactionIds && transactionsToMatch.length !== validatedData.transactionIds.length) {
      return res.status(409).json({ success: false, error: 'One or more transactions are unavailable for reconciliation' });
    }

    if (transactionsToMatch.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No matching transactions found',
      });
    }

    // Calculate matched total
    const matchedTotal = transactionsToMatch.reduce(
      (sum, t) => sum + Number(t.totalAmount),
      0
    );
    const expectedTotal = Number(remittance.totalAmount);
    const variance = expectedTotal - matchedTotal;

    // Transaction updates and reconciliation evidence must commit or roll back together.
    // The tenant and remittance predicates are repeated inside the transaction.
    const newStatus = Math.abs(variance) < 0.01 ? 'reconciled' : 'variance_detected';
    const updatedRemittance = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: schema.employerRemittances.id, reconciliationStatus: schema.employerRemittances.reconciliationStatus })
        .from(schema.employerRemittances)
        .where(and(
          eq(schema.employerRemittances.id, id),
          eq(schema.employerRemittances.tenantId, scopedOrgId),
        ))
        .for('update')
        .limit(1);

      if (!current || current.reconciliationStatus === 'reconciled') {
        throw new Error('Remittance changed while reconciling');
      }

      const updatedTransactions = await tx
        .update(schema.duesTransactions)
        .set({
          paidDate: remittance.remittanceDate,
          notes: `Paid via remittance ${id}`,
        } as any as Partial<typeof schema.duesTransactions.$inferInsert>)
        .where(and(
          eq(schema.duesTransactions.organizationId, scopedOrgId),
          isNull(schema.duesTransactions.paidDate),
          sql`${schema.duesTransactions.id} = ANY(${transactionsToMatch.map((t) => t.id)})`,
        ))
        .returning({ id: schema.duesTransactions.id });
      if (updatedTransactions.length !== transactionsToMatch.length) {
        throw new Error('Transactions changed while reconciling');
      }

      const [updated] = await tx
        .update(schema.employerRemittances)
        .set({
          reconciliationStatus: newStatus,
          varianceAmount: variance.toString(),
          reconciliationDate: new Date().toISOString(),
          reconciledBy: userId ?? fallbackUserId,
          metadata: {
            matchedTransactions: transactionsToMatch.length,
            matchedAmount: matchedTotal,
          },
        } as any as Partial<typeof schema.employerRemittances.$inferInsert>)
        .where(and(
          eq(schema.employerRemittances.id, id),
          eq(schema.employerRemittances.tenantId, scopedOrgId),
        ))
        .returning();
      if (!updated) throw new Error('Remittance update failed');
      return updated;
    });

    res.json({
      success: true,
      data: {
        remittance: updatedRemittance,
        matchedTransactions: transactionsToMatch.length,
        matchedAmount: matchedTotal,
        expectedAmount: expectedTotal,
        variance,
        status: newStatus,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /api/remittances/:id
 * Update remittance details
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId, tenantId, role } = getAuthUser(req);
    const scopedOrgId = organizationId ?? tenantId;
    const { id } = req.params;

    if (!scopedOrgId) {
      return res.status(401).json({ success: false, error: 'Missing organization context' });
    }

    const effectiveRole = role ?? '';
    if (!['admin', 'financial_admin'].includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const updateSchema = z.object({
      notes: z.string().optional(),
      referenceNumber: z.string().optional(),
    });

    const validatedData = updateSchema.parse(req.body);

    const [updatedRemittance] = await db
      .update(schema.employerRemittances)
      .set({
        ...validatedData,
        // updatedAt is handled automatically by database trigger
      } as any as Partial<typeof schema.employerRemittances.$inferInsert>)
      .where(
        and(
          eq(schema.employerRemittances.id, id),
          eq(schema.employerRemittances.tenantId, scopedOrgId)
        )
      )
      .returning();

    if (!updatedRemittance) {
      return res.status(404).json({
        success: false,
        error: 'Remittance not found',
      });
    }

    res.json({
      success: true,
      data: updatedRemittance,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.issues,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/remittances/upload
 * Upload and parse remittance file (CSV, Excel, XML)
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { role, organizationId, tenantId } = getAuthUser(req);
    if (!(organizationId ?? tenantId)) {
      return res.status(401).json({ success: false, error: 'Missing organization context' });
    }

    const effectiveRole = role ?? '';
    if (!['admin', 'financial_admin'].includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    const file = req.file;
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

    // Parse configuration from request body
    let parserConfig = {};
    if (req.body.config) {
      try {
        parserConfig = JSON.parse(req.body.config);
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid parser configuration JSON',
        });
      }
    }

    const parser = new RemittanceParser(parserConfig);
    let parseResult;

    // Parse based on file type
    if (fileExtension === 'csv') {
      parseResult = await parser.parseCSV(file.buffer);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      parseResult = await parser.parseExcel(file.buffer);
    } else if (fileExtension === 'xml') {
      parseResult = await parser.parseXML(file.buffer);
    } else {
      return res.status(400).json({
        success: false,
        error: `Unsupported file type: ${fileExtension}. Supported types: csv, xlsx, xls, xml`,
      });
    }

    res.json({
      success: parseResult.success,
      data: {
        fileName: file.originalname,
        fileSize: file.size,
        parsedRecords: parseResult.records,
        summary: parseResult.summary,
        errors: parseResult.errors,
      },
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/remittances/:id/report
 * Generate reconciliation report
 */
router.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const { organizationId, tenantId } = getAuthUser(req);
    const scopedOrgId = organizationId ?? tenantId;
    const { id } = req.params;
    const { format = 'json' } = req.query;

    if (!scopedOrgId) {
      return res.status(401).json({ success: false, error: 'Missing organization context' });
    }

    // Fetch remittance
    const [remittance] = await db
      .select()
      .from(schema.employerRemittances)
      .where(
        and(
          eq(schema.employerRemittances.id, id),
          eq(schema.employerRemittances.tenantId, scopedOrgId)
        )
      )
      .limit(1);

    if (!remittance) {
      return res.status(404).json({
        success: false,
        error: 'Remittance not found',
      });
    }

    // Fetch matched transactions
    // Fetch matched transactions - remittanceId doesn't exist
    // Would need to query by notes or metadata
    const transactions: TxSummaryRow[] = [];

    const reportData = {
      remittance: {
        id: remittance.id,
        employerId: remittance.employerId,
        totalAmount: remittance.totalAmount,
        memberCount: remittance.memberCount,
        remittanceDate: remittance.remittanceDate,
        reconciliationStatus: remittance.reconciliationStatus,
        varianceAmount: remittance.varianceAmount,
      },
      transactions: transactions.map((t) => ({
        id: t.id,
        memberId: t.memberId,
        amount: t.amount,
        status: t.status,
        paidDate: t.paidDate,
      })),
      summary: {
        matchedCount: transactions.length,
        totalReconciled: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
        variance: remittance.varianceAmount,
      },
    };

    if (format === 'text') {
      // Generate text report
      const lines = [
        '=== REMITTANCE REPORT ===',
        '',
        `Remittance ID: ${remittance.id}`,
        `Remittance Date: ${remittance.remittanceDate}`,
        `Total Amount: $${Number(remittance.totalAmount).toFixed(2)}`,
        `Member Count: ${remittance.memberCount}`,
        `Status: ${remittance.reconciliationStatus || remittance.status}`,
        '',
        '--- Matched Transactions ---',
        ...transactions.map(
          (t) =>
            `${t.memberId}: $${Number(t.amount).toFixed(2)} (${t.paidDate || 'N/A'})`
        ),
        '',
        `Total Matched: ${transactions.length}`,
        `Total Reconciled: $${reportData.summary.totalReconciled.toFixed(2)}`,
        `Variance: $${Number(remittance.varianceAmount || 0).toFixed(2)}`,
        '',
        '=== END OF REPORT ===',
      ];

      res.setHeader('Content-Type', 'text/plain');
      res.send(lines.join('\n'));
    } else {
      res.json({
        success: true,
        data: reportData,
      });
    }
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
