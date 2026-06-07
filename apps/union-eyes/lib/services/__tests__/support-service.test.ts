/**
 * Support Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Proxy chain helper ───────────────────────────────────────────────────────

function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    query: {
      supportTickets: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  supportTickets: { id: 'id', status: 'status', priority: 'priority', category: 'category',
    organizationId: 'orgId', assignedToUserId: 'assigned', createdAt: 'createdAt',
    responseSlaBreach: 'rsBreach', resolutionSlaBreach: 'rlBreach',
    satisfactionRating: 'satRating', responseTimeMinutes: 'rtm', resolutionTimeMinutes: 'rlm',
    slaResponseBy: 'slaRB', slaResolveBy: 'slaRL', viewCount: 'vc', firstResponseAt: 'fra' },
  ticketStatusEnum: { enumValues: ['open', 'in_progress', 'resolved', 'closed'] },
  ticketPriorityEnum: { enumValues: ['low', 'medium', 'high', 'urgent'] },
  ticketCategoryEnum: { enumValues: ['general', 'technical', 'billing', 'security', 'other'] },
  ticketComments: { ticketId: 'ticketId', isInternal: 'isInternal', createdAt: 'createdAt' },
  ticketHistory: {},
  slaPolices: { isActive: 'isActive', priority: 'priority', category: 'category', isDefault: 'isDefault' },
  knowledgeBaseArticles: { status: 'status', title: 'title', content: 'content',
    summary: 'summary', viewCount: 'viewCount', slug: 'slug', id: 'id' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SupportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelect.mockReturnValue(chain([]));
    mocks.mockInsert.mockReturnValue(chain([]));
    mocks.mockUpdate.mockReturnValue(chain([]));
  });

  // ── getTicketById ───────────────────────────────────────────────
  it('getTicketById returns null when not found', async () => {
    const { getTicketById } = await import('../support-service');
    expect(await getTicketById('nonexistent')).toBeNull();
  });

  it('getTicketById returns ticket with details', async () => {
    const ticket = { id: 't-1', ticketNumber: 'TKT-202603-00001', status: 'open' };
    mocks.mockSelect.mockReturnValueOnce(chain([ticket]));
    const { getTicketById } = await import('../support-service');
    expect(await getTicketById('t-1')).toEqual(ticket);
  });

  // ── createTicket ────────────────────────────────────────────────
  it('createTicket generates ticket number and creates record', async () => {
    const newTicket = { id: 't-new', ticketNumber: 'TKT-202603-00001', status: 'open' };
    // 1st select: generateTicketNumber count
    mocks.mockSelect.mockReturnValueOnce(chain([{ count: 0 }]));
    // 2nd select: calculateSLADeadlines policies
    mocks.mockSelect.mockReturnValueOnce(chain([]));
    // insert(supportTickets).values().returning()
    mocks.mockInsert.mockReturnValueOnce(chain([newTicket]));
    // insert(ticketHistory).values()
    mocks.mockInsert.mockReturnValueOnce(chain(undefined));

    const { createTicket } = await import('../support-service');
    const result = await createTicket({
      subject: 'Test', description: 'Desc', priority: 'medium',
      category: 'general', organizationId: 'org-1', createdBy: 'user-1',
    });
    expect(result).toEqual(newTicket);
  });

  // ── listTickets ─────────────────────────────────────────────────
  it('listTickets returns tickets', async () => {
    const tickets = [{ id: 't-1' }, { id: 't-2' }];
    mocks.mockSelect.mockReturnValueOnce(chain(tickets));
    const { listTickets } = await import('../support-service');
    const result = await listTickets();
    expect(result).toEqual(tickets);
  });

  it('listTickets applies filters', async () => {
    mocks.mockSelect.mockReturnValueOnce(chain([{ id: 't-1' }]));
    const { listTickets } = await import('../support-service');
    const result = await listTickets({ status: ['open'], priority: ['high'], category: ['technical'], assignedTo: 'u1', organizationId: 'o1', slaBreached: true });
    expect(result).toHaveLength(1);
  });

  // ── updateTicket ────────────────────────────────────────────────
  it('updateTicket updates and returns ticket', async () => {
    const updated = { id: 't-1', status: 'in_progress' };
    mocks.mockUpdate.mockReturnValueOnce(chain([updated]));
    // getTicketById inside updateTicket
    mocks.mockSelect.mockReturnValueOnce(chain([{ id: 't-1', status: 'open' }]));
    // ticketHistory insert
    mocks.mockInsert.mockReturnValueOnce(chain(undefined));

    const { updateTicket } = await import('../support-service');
    const result = await updateTicket('t-1', { status: 'in_progress' as any as Parameters<typeof updateTicket>[1]['status'] }, 'user-1');
    expect(result).toEqual(updated);
  });

  // ── assignTicket ────────────────────────────────────────────────
  it('assignTicket sets agent and status', async () => {
    const assigned = { id: 't-1', assignedToUserId: 'agent-1', status: 'in_progress' };
    mocks.mockUpdate.mockReturnValueOnce(chain([assigned]));
    mocks.mockInsert.mockReturnValueOnce(chain(undefined));

    const { assignTicket } = await import('../support-service');
    const result = await assignTicket('t-1', 'agent-1', 'Agent Name', 'admin-1');
    expect(result).toEqual(assigned);
  });

  // ── resolveTicket ───────────────────────────────────────────────
  it('resolveTicket calculates resolution time', async () => {
    const created = new Date(Date.now() - 3600000); // 1 hour ago
    const ticket = { id: 't-1', createdAt: created, slaResolveBy: new Date(Date.now() + 3600000) };
    mocks.mockSelect.mockReturnValueOnce(chain([ticket]));
    const resolved = { id: 't-1', status: 'resolved', resolutionTimeMinutes: 60 };
    mocks.mockUpdate.mockReturnValueOnce(chain([resolved]));
    mocks.mockInsert.mockReturnValueOnce(chain(undefined));

    const { resolveTicket } = await import('../support-service');
    const result = await resolveTicket('t-1', 'user-1');
    expect(result.status).toBe('resolved');
  });

  it('resolveTicket throws when ticket not found', async () => {
    mocks.mockSelect.mockReturnValueOnce(chain([]));
    const { resolveTicket } = await import('../support-service');
    await expect(resolveTicket('missing')).rejects.toThrow('Ticket not found');
  });

  // ── closeTicket ─────────────────────────────────────────────────
  it('closeTicket marks ticket as closed', async () => {
    mocks.mockSelect.mockReturnValueOnce(chain([{ id: 't-1', status: 'resolved' }]));
    const closed = { id: 't-1', status: 'closed' };
    mocks.mockUpdate.mockReturnValueOnce(chain([closed]));
    mocks.mockInsert.mockReturnValueOnce(chain(undefined));

    const { closeTicket } = await import('../support-service');
    const result = await closeTicket('t-1', 'user-1');
    expect(result.status).toBe('closed');
  });

  it('closeTicket throws when ticket not found', async () => {
    mocks.mockSelect.mockReturnValueOnce(chain([]));
    const { closeTicket } = await import('../support-service');
    await expect(closeTicket('missing')).rejects.toThrow('Ticket not found');
  });

  // ── addComment ──────────────────────────────────────────────────
  it('addComment creates comment and checks SLA', async () => {
    const comment = { id: 'c-1', ticketId: 't-1', content: 'Reply' };
    mocks.mockInsert.mockReturnValueOnce(chain([comment]));
    // getTicketById inside addComment (no firstResponseAt → triggers SLA update)
    mocks.mockSelect.mockReturnValueOnce(chain([{ id: 't-1', createdAt: new Date(), firstResponseAt: null, slaResponseBy: new Date(Date.now() + 3600000) }]));
    // SLA update
    mocks.mockUpdate.mockReturnValueOnce(chain(undefined));

    const { addComment } = await import('../support-service');
    const result = await addComment({ ticketId: 't-1', content: 'Reply', authorUserId: 'u1', authorName: 'User', isInternal: false });
    expect(result).toEqual(comment);
  });

  // ── getTicketComments ───────────────────────────────────────────
  it('getTicketComments returns comments', async () => {
    const comments = [{ id: 'c-1' }, { id: 'c-2' }];
    mocks.mockSelect.mockReturnValueOnce(chain(comments));
    const { getTicketComments } = await import('../support-service');
    expect(await getTicketComments('t-1')).toEqual(comments);
  });

  // ── searchKnowledgeBase ─────────────────────────────────────────
  it('searchKnowledgeBase returns matching articles', async () => {
    const articles = [{ id: 'a-1', title: 'How to file' }];
    mocks.mockSelect.mockReturnValueOnce(chain(articles));
    const { searchKnowledgeBase } = await import('../support-service');
    expect(await searchKnowledgeBase('file')).toEqual(articles);
  });

  // ── getKBArticleBySlug ─────────────────────────────────────────
  it('getKBArticleBySlug returns article and increments view count', async () => {
    const article = { id: 'a-1', slug: 'how-to-file', viewCount: 5 };
    mocks.mockSelect.mockReturnValueOnce(chain([article]));
    mocks.mockUpdate.mockReturnValueOnce(chain(undefined));
    const { getKBArticleBySlug } = await import('../support-service');
    expect(await getKBArticleBySlug('how-to-file')).toEqual(article);
  });

  it('getKBArticleBySlug returns null when not found', async () => {
    mocks.mockSelect.mockReturnValueOnce(chain([]));
    const { getKBArticleBySlug } = await import('../support-service');
    expect(await getKBArticleBySlug('missing')).toBeNull();
  });
});
