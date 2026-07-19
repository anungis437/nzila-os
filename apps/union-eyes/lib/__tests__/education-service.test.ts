import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockFindFirstCourse: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      trainingCourses: { findFirst: mocks.mockFindFirstCourse },
    },
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

vi.mock('@/db/schema', () => ({
  trainingCourses: {
    id: 'id',
    organizationId: 'organizationId',
    courseCategory: 'courseCategory',
    isActive: 'isActive',
    isMandatory: 'isMandatory',
    courseName: 'courseName',
    courseDescription: 'courseDescription',
    courseCode: 'courseCode',
    createdAt: 'createdAt',
    certificationValidYears: 'certificationValidYears',
  },
  courseSessions: {
    id: 'id',
    courseId: 'courseId',
    startDate: 'startDate',
    endDate: 'endDate',
    deliveryMethod: 'deliveryMethod',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: any[]) => ({ _type: 'eq', _args: a })),
  and: vi.fn((...a: any[]) => ({ _type: 'and', _args: a })),
  or: vi.fn((...a: any[]) => ({ _type: 'or', _args: a })),
  desc: vi.fn((c: any) => ({ _type: 'desc', _col: c })),
  asc: vi.fn((c: any) => ({ _type: 'asc', _col: c })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  count: vi.fn(() => 'count_fn'),
  gte: vi.fn((...a: any[]) => ({ _type: 'gte', _args: a })),
  lte: vi.fn((...a: any[]) => ({ _type: 'lte', _args: a })),
  like: vi.fn((...a: any[]) => ({ _type: 'like', _args: a })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(result: any = undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'set', 'values', 'returning']) {
    c[m] = vi.fn(() => c);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c.then = (resolve: any) => resolve(result);
  return c;
}

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
import {
  getCourseById,
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  createSession,
  updateSession,
  getCourseSessions,
  enrollMember,
  getMemberCourses,
  updateMemberProgress,
  getMemberProgress,
  createQuiz,
  submitQuiz,
  getQuizResults,
  generateCertificate,
  getMemberCertificates,
  verifyCertificate,
  createLearningPath,
  getLearningPaths,
  getCourseStatistics,
  getOrganizationStatistics,
} from '@/lib/services/education-service';

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

const COURSE = {
  id: 'c1',
  courseName: 'Safety 101',
  courseCode: 'SAF-101',
  courseDescription: 'Safety basics',
  organizationId: 'org-1',
  isActive: true,
  isMandatory: false,
  certificationValidYears: 2,
  createdAt: new Date(),
};

const SESSION = {
  id: 's1',
  courseId: 'c1',
  startDate: '2026-06-01',
  endDate: '2026-06-02',
  deliveryMethod: 'online',
};

describe('education-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // getCourseById
  // ================================================================
  describe('getCourseById', () => {
    it('returns course when found', async () => {
      mocks.mockFindFirstCourse.mockResolvedValue(COURSE);
      const result = await getCourseById('c1');
      expect(result).toEqual(COURSE);
    });

    it('returns null when not found', async () => {
      mocks.mockFindFirstCourse.mockResolvedValue(undefined);
      const result = await getCourseById('missing');
      expect(result).toBeNull();
    });

    it('includes sessions when requested', async () => {
      mocks.mockFindFirstCourse.mockResolvedValue(COURSE);
      mocks.mockSelect.mockReturnValue(chain([SESSION]));

      const result = await getCourseById('c1', true);
      expect(result).toEqual({ ...COURSE, sessions: [SESSION] });
    });

    it('throws on database error', async () => {
      mocks.mockFindFirstCourse.mockRejectedValue(new Error('db down'));
      await expect(getCourseById('c1')).rejects.toThrow('Failed to fetch course');
    });
  });

  // ================================================================
  // listCourses
  // ================================================================
  describe('listCourses', () => {
    it('returns paginated results with defaults', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([COURSE]));

      const result = await listCourses();
      expect(result).toEqual({ courses: [COURSE], total: 1, page: 1, limit: 20 });
    });

    it('applies all filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await listCourses(
        { organizationId: 'org-1', category: 'safety', isActive: true, isMandatory: false, searchQuery: 'fire' },
        { page: 2, limit: 10 },
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockReturnValue(chain());
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(listCourses()).rejects.toThrow('Failed to list courses');
    });
  });

  // ================================================================
  // createCourse
  // ================================================================
  describe('createCourse', () => {
    it('inserts and returns course', async () => {
      mocks.mockInsert.mockReturnValue(chain([COURSE]));
      const result = await createCourse(COURSE as never);
      expect(result).toEqual(COURSE);
    });

    it('throws on error', async () => {
      mocks.mockInsert.mockReturnValue(chain());
      mocks.mockInsert.mockImplementation(() => { throw new Error('dup'); });
      await expect(createCourse(COURSE as never)).rejects.toThrow('Failed to create course');
    });
  });

  // ================================================================
  // updateCourse
  // ================================================================
  describe('updateCourse', () => {
    it('updates and returns course', async () => {
      const updated = { ...COURSE, courseName: 'Updated' };
      mocks.mockUpdate.mockReturnValue(chain([updated]));
      const result = await updateCourse('c1', { courseName: 'Updated' } as never);
      expect(result).toEqual(updated);
    });

    it('returns null when no row matched', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      const result = await updateCourse('missing', {} as never);
      expect(result).toBeNull();
    });
  });

  // ================================================================
  // deleteCourse
  // ================================================================
  describe('deleteCourse', () => {
    it('deletes and returns true', async () => {
      mocks.mockDelete.mockReturnValue(chain());
      const result = await deleteCourse('c1');
      expect(result).toBe(true);
    });

    it('throws on error', async () => {
      mocks.mockDelete.mockImplementation(() => { throw new Error('fk'); });
      await expect(deleteCourse('c1')).rejects.toThrow('Failed to delete course');
    });
  });

  // ================================================================
  // Session operations
  // ================================================================
  describe('createSession', () => {
    it('inserts and returns session', async () => {
      mocks.mockInsert.mockReturnValue(chain([SESSION]));
      const result = await createSession(SESSION as never);
      expect(result).toEqual(SESSION);
    });
  });

  describe('updateSession', () => {
    it('updates and returns session', async () => {
      const updated = { ...SESSION, deliveryMethod: 'in_person' };
      mocks.mockUpdate.mockReturnValue(chain([updated]));
      const result = await updateSession('s1', { deliveryMethod: 'in_person' } as never);
      expect(result).toEqual(updated);
    });

    it('returns null when not found', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      const result = await updateSession('missing', {} as never);
      expect(result).toBeNull();
    });
  });

  describe('getCourseSessions', () => {
    it('returns sessions for course', async () => {
      mocks.mockSelect.mockReturnValue(chain([SESSION]));
      const result = await getCourseSessions('c1');
      expect(result).toEqual([SESSION]);
    });

    it('applies date and delivery filters', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const result = await getCourseSessions('c1', {
        startDateFrom: new Date('2026-01-01'),
        startDateTo: new Date('2026-12-31'),
        deliveryMethod: 'online',
      });
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getCourseSessions('c1')).rejects.toThrow('Failed to fetch course sessions');
    });
  });

  // ================================================================
  // Enrollment
  // ================================================================
  describe('enrollMember', () => {
    it('returns success with enrollment id', async () => {
      const result = await enrollMember('m1', 'c1');
      expect(result.success).toBe(true);
      expect(result.enrollmentId).toMatch(/^enrollment-/);
    });
  });

  describe('getMemberCourses', () => {
    it('returns active courses', async () => {
      mocks.mockSelect.mockReturnValue(chain([COURSE]));
      const result = await getMemberCourses('m1', 'org-1');
      expect(result).toEqual([COURSE]);
    });
  });

  // ================================================================
  // Progress
  // ================================================================
  describe('updateMemberProgress', () => {
    it('returns success', async () => {
      const result = await updateMemberProgress('m1', 'c1', { percentComplete: 50 });
      expect(result).toEqual({ success: true });
    });
  });

  describe('getMemberProgress', () => {
    it('returns default values', async () => {
      const result = await getMemberProgress('m1', 'c1');
      expect(result).toEqual({
        percentComplete: 0,
        completedLessons: [],
        currentLesson: null,
        lastAccessedAt: null,
        estimatedCompletionDate: null,
      });
    });
  });

  // ================================================================
  // Quiz
  // ================================================================
  describe('createQuiz', () => {
    it('returns success with quiz id', async () => {
      const result = await createQuiz('c1', {
        title: 'Final',
        questions: [],
        passingScore: 70,
      });
      expect(result.success).toBe(true);
      expect(result.quizId).toMatch(/^quiz-/);
    });
  });

  describe('submitQuiz', () => {
    it('throws quiz not found (stub returns null)', async () => {
      await expect(submitQuiz('m1', 'q1', {})).rejects.toThrow('Failed to submit quiz');
    });
  });

  describe('getQuizResults', () => {
    it('returns empty array', async () => {
      const result = await getQuizResults('m1', 'q1');
      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // Certification
  // ================================================================
  describe('generateCertificate', () => {
    it('generates certificate from course', async () => {
      mocks.mockFindFirstCourse.mockResolvedValue(COURSE);
      const cert = await generateCertificate('m1', 'c1');
      expect(cert.courseName).toBe('Safety 101');
      expect(cert.memberId).toBe('m1');
      expect(cert.courseId).toBe('c1');
      expect(cert.certificateNumber).toMatch(/^CERT-/);
      expect(cert.verificationUrl).toContain('/certificates/verify/');
    });

    it('sets expiry when course has certificationValidYears', async () => {
      mocks.mockFindFirstCourse.mockResolvedValue({ ...COURSE, certificationValidYears: 3 });
      const cert = await generateCertificate('m1', 'c1');
      expect(cert.expiryDate).toBeDefined();
      const yearDiff = cert.expiryDate!.getFullYear() - cert.issuedDate.getFullYear();
      expect(yearDiff).toBe(3);
    });

    it('throws when course not found', async () => {
      mocks.mockFindFirstCourse.mockResolvedValue(undefined);
      await expect(generateCertificate('m1', 'missing')).rejects.toThrow('Failed to generate certificate');
    });
  });

  describe('getMemberCertificates', () => {
    it('returns empty array', async () => {
      const result = await getMemberCertificates('m1');
      expect(result).toEqual([]);
    });
  });

  describe('verifyCertificate', () => {
    it('returns null', async () => {
      const result = await verifyCertificate('CERT-123');
      expect(result).toBeNull();
    });
  });

  // ================================================================
  // Learning Paths
  // ================================================================
  describe('createLearningPath', () => {
    it('creates path with generated id', async () => {
      const result = await createLearningPath({
        name: 'Onboarding',
        description: 'New hire path',
        courses: ['c1', 'c2'],
        estimatedDuration: 40,
      });
      expect(result.id).toMatch(/^path-/);
      expect(result.name).toBe('Onboarding');
    });
  });

  describe('getLearningPaths', () => {
    it('returns empty array', async () => {
      const result = await getLearningPaths('org-1');
      expect(result).toEqual([]);
    });
  });

  // ================================================================
  // Statistics
  // ================================================================
  describe('getCourseStatistics', () => {
    it('returns zeroed stats', async () => {
      const stats = await getCourseStatistics('c1');
      expect(stats).toEqual({
        totalEnrollments: 0,
        activeEnrollments: 0,
        completionRate: 0,
        averageScore: 0,
        averageCompletionTime: 0,
      });
    });
  });

  describe('getOrganizationStatistics', () => {
    it('returns stats from listCourses', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 2 }]))
        .mockReturnValueOnce(chain([COURSE, { ...COURSE, id: 'c2', isActive: true }]));

      const stats = await getOrganizationStatistics('org-1');
      expect(stats.totalCourses).toBe(2);
      expect(stats.activeCourses).toBe(2);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getOrganizationStatistics('org-1')).rejects.toThrow('Failed to fetch statistics');
    });
  });
});
