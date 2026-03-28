/**
 * Support Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockReturning, mockInsertValues, mockSelect } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockReturning: vi.fn(),
  mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
  mockSelect: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      supportTickets: { findFirst: mockFindFirst },
      slaPolices: { findFirst: mockFindFirst },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: mockSelect,
  },
}));

vi.mock('@/db/schema', () => ({
  supportTickets: {},
  ticketComments: {},
  ticketHistory: {},
  slaPolices: {},
  knowledgeBaseArticles: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { createTicket, getTicketById } from '../support-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SupportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
    mockReturning.mockResolvedValue([]);
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      }),
    });
  });

  it('getTicketById returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getTicketById('nonexistent');
    expect(result).toBeNull();
  });

  it('getTicketById returns ticket with details', async () => {
    const mockTicket = {
      id: 'ticket-1',
      ticketNumber: 'TKT-202603-00001',
      subject: 'Test issue',
      status: 'open',
    };
    mockFindFirst.mockResolvedValue(mockTicket);

    const result = await getTicketById('ticket-1');
    expect(result).toEqual(mockTicket);
    expect(result?.ticketNumber).toContain('TKT-');
  });

  it('createTicket generates ticket number and creates record', async () => {
    // Mock the count query for ticket number generation
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        }),
      }),
    });

    const newTicket = {
      id: 'ticket-new',
      ticketNumber: 'TKT-202603-00001',
      subject: 'Test',
      status: 'open',
    };
    mockReturning.mockResolvedValue([newTicket]);

    const result = await createTicket({
      subject: 'Test',
      description: 'Test description',
      priority: 'medium',
      category: 'general',
      organizationId: 'org-1',
      createdBy: 'user-1',
    });

    expect(result).toBeDefined();
  });

  it('handles ticket creation with SLA defaults', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const ticket = { id: 't1', ticketNumber: 'TKT-202603-00001' };
    mockReturning.mockResolvedValue([ticket]);

    const result = await createTicket({
      subject: 'Urgent',
      description: 'Urgent issue',
      priority: 'urgent',
      category: 'technical',
      organizationId: 'org-1',
      createdBy: 'user-1',
    });

    expect(result).toBeDefined();
  });
});
