/**
 * Support Ticketing Service
 * 
 * Handles support ticket management, SLA tracking, and knowledge base operations
 * for Nzila Ventures operations team
 */

import { db } from '@/db';
import {
  supportTickets,
  ticketComments,
  ticketHistory,
  slaPolices,
  knowledgeBaseArticles,
  type SupportTicket,
  type NewSupportTicket,
  type TicketComment,
  type NewTicketComment,
  type KnowledgeBaseArticle,
} from '@/db/schema';
import { eq, and, sql, desc, asc, or, gte, count, avg, inArray, type SQL } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TicketFilters {
  status?: string[];
  priority?: string[];
  category?: string[];
  assignedTo?: string;
  organizationId?: string;
  search?: string;
  slaBreached?: boolean;
}

export interface TicketMetrics {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  byPriority: { priority: string; count: number }[];
  byCategory: { category: string; count: number }[];
  avgResponseTimeMinutes: number;
  avgResolutionTimeMinutes: number;
  slaCompliance: number;
  satisfactionRating: number;
}

export interface SLAMetrics {
  totalTickets: number;
  withinSLA: number;
  breachedSLA: number;
  complianceRate: number;
  avgResponseTime: number;
  avgResolutionTime: number;
}

// ============================================================================
// TICKET GENERATION
// ============================================================================

/**
 * Generate a unique ticket number
 */
async function generateTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get count of tickets this month
  const monthStart = new Date(year, new Date().getMonth(), 1);
  const result = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(gte(supportTickets.createdAt, monthStart));
  
  const sequence = (result[0]?.count || 0) + 1;
  return `TKT-${year}${month}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Calculate SLA deadlines based on priority and policy
 */
async function calculateSLADeadlines(
  priority: string,
  category: string,
  createdAt: Date = new Date()
): Promise<{ responseBy: Date; resolveBy: Date }> {
  // Get applicable SLA policy
  const policies = await db
    .select()
    .from(slaPolices)
    .where(
      and(
        eq(slaPolices.isActive, true),
        or(
          and(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq(slaPolices.priority, priority as any),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq(slaPolices.category, category as any)
          ),
          and(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            eq(slaPolices.priority, priority as any),
            sql`${slaPolices.category} IS NULL`
          ),
          eq(slaPolices.isDefault, true)
        )
      )
    )
    .orderBy(desc(slaPolices.priority))
    .limit(1);
  
  const policy = policies[0] || {
    responseTimeMinutes: 60,
    resolutionTimeMinutes: 240,
  };
  
  const responseBy = new Date(createdAt.getTime() + policy.responseTimeMinutes * 60000);
  const resolveBy = new Date(createdAt.getTime() + policy.resolutionTimeMinutes * 60000);
  
  return { responseBy, resolveBy };
}

// ============================================================================
// TICKET CRUD OPERATIONS
// ============================================================================

/**
 * Create a new support ticket
 */
export async function createTicket(
  data: Omit<NewSupportTicket, 'ticketNumber' | 'slaResponseBy' | 'slaResolveBy'>
): Promise<SupportTicket> {
  try {
    const ticketNumber = await generateTicketNumber();
    const sla = await calculateSLADeadlines(data.priority ?? 'medium', data.category);
    
    const [ticket] = await db
      .insert(supportTickets)
      .values({
        ...data,
        ticketNumber,
        slaResponseBy: sla.responseBy,
        slaResolveBy: sla.resolveBy,
      })
      .returning();
    
    // Create history entry
    await db.insert(ticketHistory).values({
      ticketId: ticket.id,
      action: 'created',
      changedByUserId: data.createdBy,
      changedByName: data.requestorName || 'System',
    });
    
    logger.info('Support ticket created', { ticketId: ticket.id, ticketNumber });
    return ticket;
  } catch (error) {
    logger.error('Error creating support ticket', { error });
    throw error;
  }
}

/**
 * Get ticket by ID
 */
export async function getTicketById(ticketId: string): Promise<SupportTicket | null> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId))
    .limit(1);
  
  return ticket || null;
}

/**
 * List tickets with filters
 */
export async function listTickets(
  filters: TicketFilters = {},
  limit: number = 50,
  offset: number = 0
): Promise<SupportTicket[]> {
  const conditions: SQL[] = [];
  
  if (filters.status?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(inArray(supportTickets.status, filters.status as any));
  }
  
  if (filters.priority?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(inArray(supportTickets.priority, filters.priority as any));
  }
  
  if (filters.category?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conditions.push(inArray(supportTickets.category, filters.category as any));
  }
  
  if (filters.assignedTo) {
    conditions.push(eq(supportTickets.assignedToUserId, filters.assignedTo));
  }
  
  if (filters.organizationId) {
    conditions.push(eq(supportTickets.organizationId, filters.organizationId));
  }
  
  if (filters.slaBreached) {
    conditions.push(
      or(
        eq(supportTickets.responseSlaBreach, true),
        eq(supportTickets.resolutionSlaBreach, true)
      )!
    );
  }
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  return db
    .select()
    .from(supportTickets)
    .where(where)
    .orderBy(
      desc(supportTickets.priority),
      desc(supportTickets.createdAt)
    )
    .limit(limit)
    .offset(offset);
}

/**
 * Update ticket
 */
export async function updateTicket(
  ticketId: string,
  updates: Partial<SupportTicket>,
  updatedBy?: string
): Promise<SupportTicket> {
  try {
    const [ticket] = await db
      .update(supportTickets)
      .set({
        ...updates,
        updatedAt: new Date(),
        updatedBy,
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    
    // Create history entries for changed fields
    const oldTicket = await getTicketById(ticketId);
    if (oldTicket) {
      for (const [key, value] of Object.entries(updates)) {
        if (oldTicket[key as keyof SupportTicket] !== value) {
          await db.insert(ticketHistory).values({
            ticketId,
            action: 'field_changed',
            field: key,
            oldValue: String(oldTicket[key as keyof SupportTicket]),
            newValue: String(value),
            changedByUserId: updatedBy,
          });
        }
      }
    }
    
    logger.info('Support ticket updated', { ticketId });
    return ticket;
  } catch (error) {
    logger.error('Error updating support ticket', { error, ticketId });
    throw error;
  }
}

/**
 * Assign ticket to agent
 */
export async function assignTicket(
  ticketId: string,
  agentUserId: string,
  agentName: string,
  assignedBy?: string
): Promise<SupportTicket> {
  const [ticket] = await db
    .update(supportTickets)
    .set({
      assignedToUserId: agentUserId,
      assignedToName: agentName,
      assignedAt: new Date(),
      status: 'in_progress',
      updatedBy: assignedBy,
    })
    .where(eq(supportTickets.id, ticketId))
    .returning();
  
  await db.insert(ticketHistory).values({
    ticketId,
    action: 'assigned',
    newValue: agentName,
    changedByUserId: assignedBy,
  });
  
  logger.info('Ticket assigned', { ticketId, agentUserId });
  return ticket;
}

/**
 * Resolve ticket
 */
export async function resolveTicket(
  ticketId: string,
  resolvedBy?: string
): Promise<SupportTicket> {
  const now = new Date();
  const ticket = await getTicketById(ticketId);
  
  if (!ticket) {
    throw new Error('Ticket not found');
  }
  
  // Calculate resolution time
  const resolutionTimeMinutes = Math.floor(
    (now.getTime() - ticket.createdAt.getTime()) / 60000
  );
  
  // Check if SLA was breached
  const resolutionSlaBreach = ticket.slaResolveBy && now > ticket.slaResolveBy;
  
  const [updatedTicket] = await db
    .update(supportTickets)
    .set({
      status: 'resolved',
      resolvedAt: now,
      resolutionTimeMinutes,
      resolutionSlaBreach,
      updatedBy: resolvedBy,
    })
    .where(eq(supportTickets.id, ticketId))
    .returning();
  
  await db.insert(ticketHistory).values({
    ticketId,
    action: 'resolved',
    changedByUserId: resolvedBy,
  });
  
  logger.info('Ticket resolved', { ticketId });
  return updatedTicket;
}

/**
 * Close ticket
 */
export async function closeTicket(
  ticketId: string,
  closedBy?: string
): Promise<SupportTicket> {
  const now = new Date();
  const ticket = await getTicketById(ticketId);
  
  if (!ticket) {
    throw new Error('Ticket not found');
  }
  
  const [updatedTicket] = await db
    .update(supportTickets)
    .set({
      status: 'closed',
      closedAt: now,
      updatedBy: closedBy,
    })
    .where(eq(supportTickets.id, ticketId))
    .returning();
  
  await db.insert(ticketHistory).values({
    ticketId,
    action: 'closed',
    changedByUserId: closedBy,
  });
  
  logger.info('Ticket closed', { ticketId });
  return updatedTicket;
}

// ============================================================================
// COMMENTS
// ============================================================================

/**
 * Add comment to ticket
 */
export async function addComment(
  data: NewTicketComment
): Promise<TicketComment> {
  const [comment] = await db
    .insert(ticketComments)
    .values(data)
    .returning();
  
  // Check if this is first response and update SLA
  const ticket = await getTicketById(data.ticketId);
  if (ticket && !ticket.firstResponseAt && !data.isInternal) {
    const now = new Date();
    const responseTimeMinutes = Math.floor(
      (now.getTime() - ticket.createdAt.getTime()) / 60000
    );
    const responseSlaBreach = ticket.slaResponseBy && now > ticket.slaResponseBy;
    
    await db
      .update(supportTickets)
      .set({
        firstResponseAt: now,
        responseTimeMinutes,
        responseSlaBreach,
      })
      .where(eq(supportTickets.id, data.ticketId));
  }
  
  logger.info('Comment added to ticket', { ticketId: data.ticketId, commentId: comment.id });
  return comment;
}

/**
 * Get comments for ticket
 */
export async function getTicketComments(
  ticketId: string,
  includeInternal: boolean = false
): Promise<TicketComment[]> {
  const conditions = [eq(ticketComments.ticketId, ticketId)];
  
  if (!includeInternal) {
    conditions.push(eq(ticketComments.isInternal, false));
  }
  
  return db
    .select()
    .from(ticketComments)
    .where(and(...conditions))
    .orderBy(asc(ticketComments.createdAt));
}

// ============================================================================
// METRICS & ANALYTICS
// ============================================================================

/**
 * Get ticket metrics
 */
export async function getTicketMetrics(
  filters: TicketFilters = {}
): Promise<TicketMetrics> {
  const conditions: SQL[] = [];
  
  if (filters.organizationId) {
    conditions.push(eq(supportTickets.organizationId, filters.organizationId));
  }
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Get overall counts
  const totalCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(where);
  
  const openCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(and(where, eq(supportTickets.status, 'open')));
  
  const inProgressCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(and(where, eq(supportTickets.status, 'in_progress')));
  
  const resolvedCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(and(where, eq(supportTickets.status, 'resolved')));
  
  const closedCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(and(where, eq(supportTickets.status, 'closed')));
  
  // Get by priority
  const byPriority = await db
    .select({
      priority: supportTickets.priority,
      count: count(),
    })
    .from(supportTickets)
    .where(where)
    .groupBy(supportTickets.priority);
  
  // Get by category
  const byCategory = await db
    .select({
      category: supportTickets.category,
      count: count(),
    })
    .from(supportTickets)
    .where(where)
    .groupBy(supportTickets.category);
  
  // Get average times
  const avgTimes = await db
    .select({
      avgResponseTime: avg(supportTickets.responseTimeMinutes),
      avgResolutionTime: avg(supportTickets.resolutionTimeMinutes),
    })
    .from(supportTickets)
    .where(where);
  
  // Calculate SLA compliance
  const breachedCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(
      and(
        where,
        or(
          eq(supportTickets.responseSlaBreach, true),
          eq(supportTickets.resolutionSlaBreach, true)
        )
      )
    );
  
  const slaCompliance = totalCount[0]?.count
    ? ((totalCount[0].count - (breachedCount[0]?.count || 0)) / totalCount[0].count) * 100
    : 100;
  
  // Get satisfaction rating
  const satisfactionResult = await db
    .select({ avgRating: avg(supportTickets.satisfactionRating) })
    .from(supportTickets)
    .where(and(where, sql`${supportTickets.satisfactionRating} IS NOT NULL`));
  
  return {
    total: totalCount[0]?.count || 0,
    open: openCount[0]?.count || 0,
    inProgress: inProgressCount[0]?.count || 0,
    resolved: resolvedCount[0]?.count || 0,
    closed: closedCount[0]?.count || 0,
    byPriority: byPriority.map(p => ({ priority: p.priority, count: p.count })),
    byCategory: byCategory.map(c => ({ category: c.category, count: c.count })),
    avgResponseTimeMinutes: Number(avgTimes[0]?.avgResponseTime) || 0,
    avgResolutionTimeMinutes: Number(avgTimes[0]?.avgResolutionTime) || 0,
    slaCompliance,
    satisfactionRating: Number(satisfactionResult[0]?.avgRating) || 0,
  };
}

/**
 * Get SLA metrics
 */
export async function getSLAMetrics(
  filters: TicketFilters = {}
): Promise<SLAMetrics> {
  const conditions: SQL[] = [];
  
  if (filters.organizationId) {
    conditions.push(eq(supportTickets.organizationId, filters.organizationId));
  }
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  const totalCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(where);
  
  const breachedCount = await db
    .select({ count: count() })
    .from(supportTickets)
    .where(
      and(
        where,
        or(
          eq(supportTickets.responseSlaBreach, true),
          eq(supportTickets.resolutionSlaBreach, true)
        )
      )
    );
  
  const avgTimes = await db
    .select({
      avgResponseTime: avg(supportTickets.responseTimeMinutes),
      avgResolutionTime: avg(supportTickets.resolutionTimeMinutes),
    })
    .from(supportTickets)
    .where(where);
  
  const total = totalCount[0]?.count || 0;
  const breached = breachedCount[0]?.count || 0;
  const withinSLA = total - breached;
  
  return {
    totalTickets: total,
    withinSLA,
    breachedSLA: breached,
    complianceRate: total ? (withinSLA / total) * 100 : 100,
    avgResponseTime: Number(avgTimes[0]?.avgResponseTime) || 0,
    avgResolutionTime: Number(avgTimes[0]?.avgResolutionTime) || 0,
  };
}

// ============================================================================
// KNOWLEDGE BASE
// ============================================================================

/**
 * Search knowledge base articles
 */
export async function searchKnowledgeBase(
  query: string,
  limit: number = 10
): Promise<KnowledgeBaseArticle[]> {
  return db
    .select()
    .from(knowledgeBaseArticles)
    .where(
      and(
        eq(knowledgeBaseArticles.status, 'published'),
        or(
          sql`${knowledgeBaseArticles.title} ILIKE ${`%${query}%`}`,
          sql`${knowledgeBaseArticles.content} ILIKE ${`%${query}%`}`,
          sql`${knowledgeBaseArticles.summary} ILIKE ${`%${query}%`}`
        )
      )
    )
    .orderBy(desc(knowledgeBaseArticles.viewCount))
    .limit(limit);
}

/**
 * Get knowledge base article by slug
 */
export async function getKBArticleBySlug(
  slug: string
): Promise<KnowledgeBaseArticle | null> {
  const [article] = await db
    .select()
    .from(knowledgeBaseArticles)
    .where(eq(knowledgeBaseArticles.slug, slug))
    .limit(1);
  
  // Increment view count
  if (article) {
    await db
      .update(knowledgeBaseArticles)
      .set({ viewCount: (article.viewCount ?? 0) + 1 })
      .where(eq(knowledgeBaseArticles.id, article.id));
  }
  
  return article || null;
}
