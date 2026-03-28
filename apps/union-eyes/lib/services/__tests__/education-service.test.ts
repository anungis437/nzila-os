/**
 * Education Service — Unit Tests
 *
 * Tests:
 *   - getCourseById: fetch course
 *   - createCourse: insert
 *   - enrollMember: enrollment creation
 *   - submitQuiz: quiz validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockInsertValues, mockReturning } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
  };
});

vi.mock('@/db/db', () => ({
  db: {
    query: {
      trainingCourses: { findFirst: mockFindFirst, findMany: mockFindMany },
      courseSessions: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: mockReturning })) })) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => []),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ offset: vi.fn(async () => []) })),
        })),
        limit: vi.fn(async () => []),
      })),
    })),
  },
}));

vi.mock('@/db/schema', () => ({
  trainingCourses: {
    id: 'id', organizationId: 'organizationId', title: 'title', status: 'status',
  },
  courseSessions: { id: 'id', courseId: 'courseId' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { getCourseById, createCourse, enrollMember, submitQuiz } from '../education-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getCourseById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns course when found', async () => {
    const course = { id: 'crs-1', title: 'Grievance Handling 101' };
    mockFindFirst.mockResolvedValue(course);
    const result = await getCourseById('crs-1');
    expect(result).toEqual(course);
  });

  it('returns null when not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const result = await getCourseById('missing');
    expect(result).toBeNull();
  });
});

describe('createCourse', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns the new course', async () => {
    const newCourse = { id: 'crs-new', title: 'Workplace Safety' };
    mockReturning.mockResolvedValue([newCourse]);
    const result = await createCourse({
      organizationId: 'org-1', title: 'Workplace Safety',
    } as never);
    expect(result).toEqual(newCourse);
  });
});

describe('enrollMember', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns success with enrollmentId', async () => {
    const result = await enrollMember('m-1', 'crs-1');
    expect(result.success).toBe(true);
    expect(result.enrollmentId).toMatch(/^enrollment-/);
  });
});

describe('submitQuiz', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws when quiz is not found', async () => {
    await expect(submitQuiz('m-1', 'nonexistent-quiz', { q1: 'A' })).rejects.toThrow(
      'Failed to submit quiz'
    );
  });
});
