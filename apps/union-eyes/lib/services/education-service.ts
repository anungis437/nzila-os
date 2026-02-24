/**
 * Education Service - Training and Learning Management
 * 
 * Provides comprehensive education operations including:
 * - Course and program management
 * - Session scheduling
 * - Enrollment and registration
 * - Progress tracking
 * - Quiz and assessment management
 * - Certification generation
 * - Learning paths
 */

import { db } from "@/db/db";
import { 
  trainingCourses,
  courseSessions,
  // Add other education tables from schema
} from "@/db/schema";
import { eq, and, or, desc, asc, sql, count, gte, lte, like } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export type NewTrainingCourse = typeof trainingCourses.$inferInsert;
export type TrainingCourse = typeof trainingCourses.$inferSelect;
export type NewCourseSession = typeof courseSessions.$inferInsert;
export type CourseSession = typeof courseSessions.$inferSelect;

export interface CourseWithSessions extends TrainingCourse {
  sessions?: CourseSession[];
  enrollmentCount?: number;
  completionRate?: number;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  courses: string[];
  estimatedDuration: number;
  prerequisites?: string[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correctAnswer: string | string[];
  points: number;
  explanation?: string;
}

export interface QuizResult {
  quizId: string;
  memberId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  completedAt: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any>;
}

export interface Certificate {
  id: string;
  memberId: string;
  courseId: string;
  courseName: string;
  issuedDate: Date;
  expiryDate?: Date;
  certificateNumber: string;
  verificationUrl: string;
}

// ============================================================================
// Course Operations
// ============================================================================

/**
 * Get course by ID
 */
export async function getCourseById(
  id: string,
  includeSessions = false
): Promise<CourseWithSessions | null> {
  try {
    const course = await db.query.trainingCourses.findFirst({
      where: eq(trainingCourses.id, id),
    });

    if (!course) return null;

    if (includeSessions) {
      const sessions = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.courseId, id))
        .orderBy(asc(courseSessions.startDate));

      return {
        ...course,
        sessions,
      };
    }

    return course;
  } catch (error) {
    logger.error("Error fetching course", { error, id });
    throw new Error("Failed to fetch course");
  }
}

/**
 * List courses
 */
export async function listCourses(
  filters: {
    organizationId?: string;
    category?: string;
    isActive?: boolean;
    isMandatory?: boolean;
    searchQuery?: string;
  } = {},
  pagination: { page?: number; limit?: number } = {}
): Promise<{ courses: TrainingCourse[]; total: number; page: number; limit: number }> {
  try {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (filters.organizationId) {
      conditions.push(eq(trainingCourses.organizationId, filters.organizationId));
    }

    if (filters.category) {
      conditions.push(eq(trainingCourses.courseCategory, filters.category));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(trainingCourses.isActive, filters.isActive));
    }

    if (filters.isMandatory !== undefined) {
      conditions.push(eq(trainingCourses.isMandatory, filters.isMandatory));
    }

    if (filters.searchQuery) {
      const searchTerm = `%${filters.searchQuery}%`;
      conditions.push(
        or(
          like(trainingCourses.courseName, searchTerm),
          like(trainingCourses.courseDescription, searchTerm),
          like(trainingCourses.courseCode, searchTerm)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, courses] = await Promise.all([
      db.select({ count: count() }).from(trainingCourses).where(whereClause),
      db.select().from(trainingCourses).where(whereClause)
        .orderBy(desc(trainingCourses.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    return {
      courses,
      total: totalResult[0]?.count || 0,
      page,
      limit,
    };
  } catch (error) {
    logger.error("Error listing courses", { error, filters });
    throw new Error("Failed to list courses");
  }
}

/**
 * Create course
 */
export async function createCourse(data: NewTrainingCourse): Promise<TrainingCourse> {
  try {
    const [course] = await db
      .insert(trainingCourses)
      .values(data)
      .returning();

    return course;
  } catch (error) {
    logger.error("Error creating course", { error });
    throw new Error("Failed to create course");
  }
}

/**
 * Update course
 */
export async function updateCourse(
  id: string,
  data: Partial<NewTrainingCourse>
): Promise<TrainingCourse | null> {
  try {
    const [updated] = await db
      .update(trainingCourses)
      .set({
        ...data,
        updatedAt: sql`NOW()`,
      })
      .where(eq(trainingCourses.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating course", { error, id });
    throw new Error("Failed to update course");
  }
}

/**
 * Delete course
 */
export async function deleteCourse(id: string): Promise<boolean> {
  try {
    await db
      .delete(trainingCourses)
      .where(eq(trainingCourses.id, id));

    return true;
  } catch (error) {
    logger.error("Error deleting course", { error, id });
    throw new Error("Failed to delete course");
  }
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Create course session
 */
export async function createSession(data: NewCourseSession): Promise<CourseSession> {
  try {
    const [session] = await db
      .insert(courseSessions)
      .values(data)
      .returning();

    return session;
  } catch (error) {
    logger.error("Error creating session", { error });
    throw new Error("Failed to create session");
  }
}

/**
 * Update session
 */
export async function updateSession(
  id: string,
  data: Partial<NewCourseSession>
): Promise<CourseSession | null> {
  try {
    const [updated] = await db
      .update(courseSessions)
      .set(data)
      .where(eq(courseSessions.id, id))
      .returning();

    return updated || null;
  } catch (error) {
    logger.error("Error updating session", { error, id });
    throw new Error("Failed to update session");
  }
}

/**
 * Get sessions for course
 */
export async function getCourseSessions(
  courseId: string,
  filters?: {
    startDateFrom?: Date;
    startDateTo?: Date;
    deliveryMethod?: string;
  }
): Promise<CourseSession[]> {
  try {
    const conditions: SQL[] = [eq(courseSessions.courseId, courseId)];

    if (filters?.startDateFrom) {
      conditions.push(gte(courseSessions.startDate, filters.startDateFrom.toISOString()));
    }

    if (filters?.startDateTo) {
      conditions.push(lte(courseSessions.endDate, filters.startDateTo.toISOString()));
    }

    if (filters?.deliveryMethod) {
      conditions.push(eq(courseSessions.deliveryMethod, filters.deliveryMethod));
    }

    const sessions = await db
      .select()
      .from(courseSessions)
      .where(and(...conditions))
      .orderBy(asc(courseSessions.startDate));

    return sessions;
  } catch (error) {
    logger.error("Error fetching course sessions", { error, courseId });
    throw new Error("Failed to fetch course sessions");
  }
}

// ============================================================================
// Enrollment Operations
// ============================================================================

/**
 * Enroll member in course
 */
export async function enrollMember(
  memberId: string,
  courseId: string,
  _sessionId?: string
): Promise<{ success: boolean; enrollmentId: string }> {
  try {
    // In production, this would insert into an enrollments table
    // For now, return success
    const enrollmentId = `enrollment-${Date.now()}`;
    
    return {
      success: true,
      enrollmentId,
    };
  } catch (error) {
    logger.error("Error enrolling member", { error, memberId, courseId });
    throw new Error("Failed to enroll member");
  }
}

/**
 * Get member's enrolled courses
 */
export async function getMemberCourses(
  memberId: string,
  organizationId: string
): Promise<TrainingCourse[]> {
  try {
    // In production, join with enrollments table
    // For now, return all active courses
    const courses = await db
      .select()
      .from(trainingCourses)
      .where(
        and(
          eq(trainingCourses.organizationId, organizationId),
          eq(trainingCourses.isActive, true)
        )
      );

    return courses;
  } catch (error) {
    logger.error("Error fetching member courses", { error, memberId });
    throw new Error("Failed to fetch member courses");
  }
}

// ============================================================================
// Progress Tracking
// ============================================================================

/**
 * Update member progress
 */
export async function updateMemberProgress(
  memberId: string,
  courseId: string,
  _progress: {
    completedLessons?: string[];
    currentLesson?: string;
    percentComplete?: number;
    lastAccessedAt?: Date;
  }
): Promise<{ success: boolean }> {
  try {
    // In production, update progress table
    return { success: true };
  } catch (error) {
    logger.error("Error updating member progress", { error, memberId, courseId });
    throw new Error("Failed to update progress");
  }
}

/**
 * Get member progress
 */
export async function getMemberProgress(
  memberId: string,
  courseId: string
): Promise<{
  percentComplete: number;
  completedLessons: string[];
  currentLesson: string | null;
  lastAccessedAt: Date | null;
  estimatedCompletionDate: Date | null;
}> {
  try {
    // In production, query progress table
    return {
      percentComplete: 0,
      completedLessons: [],
      currentLesson: null,
      lastAccessedAt: null,
      estimatedCompletionDate: null,
    };
  } catch (error) {
    logger.error("Error fetching member progress", { error, memberId, courseId });
    throw new Error("Failed to fetch progress");
  }
}

// ============================================================================
// Quiz Management
// ============================================================================

/**
 * Create quiz
 */
export async function createQuiz(
  courseId: string,
  _quiz: {
    title: string;
    description?: string;
    questions: QuizQuestion[];
    passingScore: number;
    timeLimit?: number;
  }
): Promise<{ success: boolean; quizId: string }> {
  try {
    const quizId = `quiz-${Date.now()}`;
    return { success: true, quizId };
  } catch (error) {
    logger.error("Error creating quiz", { error, courseId });
    throw new Error("Failed to create quiz");
  }
}

/**
 * Submit quiz answers and auto-grade
 */
export async function submitQuiz(
  memberId: string,
  quizId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answers: Record<string, any>
): Promise<QuizResult> {
  try {
    // Fetch quiz questions (in production, query from quiz_questions table)
    // For now, we&apos;ll simulate fetching the quiz structure
    const quizData = await getQuizById(quizId);
    if (!quizData) {
      throw new Error("Quiz not found");
    }

    const questions = quizData.questions;
    let score = 0;
    let totalPoints = 0;

    // Auto-grade each question
    questions.forEach((question: QuizQuestion) => {
      totalPoints += question.points;
      const userAnswer = answers[question.id];

      if (!userAnswer) {
        return; // No answer provided
      }

      let isCorrect = false;

      switch (question.type) {
        case "multiple_choice":
          // Compare answer directly
          isCorrect = String(userAnswer).toLowerCase().trim() === 
                      String(question.correctAnswer).toLowerCase().trim();
          break;

        case "true_false":
          // Boolean comparison
          isCorrect = Boolean(userAnswer) === Boolean(question.correctAnswer);
          break;

        case "short_answer":
          // Fuzzy matching for short answers
          const userText = String(userAnswer).toLowerCase().trim();
          const correctTexts = Array.isArray(question.correctAnswer) 
            ? question.correctAnswer.map(a => String(a).toLowerCase().trim())
            : [String(question.correctAnswer).toLowerCase().trim()];
          
          // Check if user answer matches any correct answer (case-insensitive)
          isCorrect = correctTexts.some(correctText => {
            // Exact match
            if (userText === correctText) return true;
            
            // Allow minor variations (e.g., "labor" vs "labour")
            const similarity = calculateStringSimilarity(userText, correctText);
            return similarity > 0.85; // 85% similarity threshold
          });
          break;

        default:
          logger.warn("Unknown question type", { questionType: question.type });
      }

      if (isCorrect) {
        score += question.points;
      }
    });

    const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    const passed = percentage >= (quizData.passingScore || 70);

    const result: QuizResult = {
      quizId,
      memberId,
      score,
      totalPoints,
      percentage,
      passed,
      completedAt: new Date(),
      answers,
    };

    // In production: Store result in database
    // await db.insert(quizResults).values(result);

    return result;
  } catch (error) {
    logger.error("Error submitting quiz", { error, quizId, memberId });
    throw new Error("Failed to submit quiz");
  }
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Helper function to get quiz by ID
 */
async function getQuizById(_quizId: string): Promise<{
  questions: QuizQuestion[];
  passingScore: number;
} | null> {
  // In production, query from database
  // For now, return null to indicate not found
  // This should be replaced with actual database query:
  // const quiz = await db.query.quizzes.findFirst({ where: eq(quizzes.id, quizId) });
  return null;
}

/**
 * Get quiz results
 */
export async function getQuizResults(
  memberId: string,
  quizId: string
): Promise<QuizResult[]> {
  try {
    // In production, query quiz results table
    return [];
  } catch (error) {
    logger.error("Error fetching quiz results", { error, quizId, memberId });
    throw new Error("Failed to fetch quiz results");
  }
}

// ============================================================================
// Certification
// ============================================================================

/**
 * Generate certificate
 */
export async function generateCertificate(
  memberId: string,
  courseId: string
): Promise<Certificate> {
  try {
    const course = await getCourseById(courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const certificateNumber = `CERT-${Date.now()}-${memberId.substring(0, 8)}`;
    const issuedDate = new Date();
    const expiryDate = course.certificationValidYears
      ? new Date(issuedDate.getFullYear() + course.certificationValidYears, issuedDate.getMonth(), issuedDate.getDate())
      : undefined;

    const certificate: Certificate = {
      id: `cert-${Date.now()}`,
      memberId,
      courseId,
      courseName: course.courseName,
      issuedDate,
      expiryDate,
      certificateNumber,
      verificationUrl: `/certificates/verify/${certificateNumber}`,
    };

    // In production, store in certificates table
    return certificate;
  } catch (error) {
    logger.error("Error generating certificate", { error, courseId, memberId });
    throw new Error("Failed to generate certificate");
  }
}

/**
 * Get member certificates
 */
export async function getMemberCertificates(
  memberId: string
): Promise<Certificate[]> {
  try {
    // In production, query certificates table
    return [];
  } catch (error) {
    logger.error("Error fetching member certificates", { error, memberId });
    throw new Error("Failed to fetch certificates");
  }
}

/**
 * Verify certificate
 */
export async function verifyCertificate(
  certificateNumber: string
): Promise<Certificate | null> {
  try {
    // In production, query certificates table
    return null;
  } catch (error) {
    logger.error("Error verifying certificate", { error, certificateNumber });
    throw new Error("Failed to verify certificate");
  }
}

// ============================================================================
// Learning Paths
// ============================================================================

/**
 * Create learning path
 */
export async function createLearningPath(
  path: Omit<LearningPath, "id">
): Promise<LearningPath> {
  try {
    const learningPath: LearningPath = {
      id: `path-${Date.now()}`,
      ...path,
    };

    // In production, store in learning_paths table
    return learningPath;
  } catch (error) {
    logger.error("Error creating learning path", { error });
    throw new Error("Failed to create learning path");
  }
}

/**
 * Get learning paths
 */
export async function getLearningPaths(
  organizationId: string
): Promise<LearningPath[]> {
  try {
    // In production, query learning_paths table
    return [];
  } catch (error) {
    logger.error("Error fetching learning paths", { error, organizationId });
    throw new Error("Failed to fetch learning paths");
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get course statistics
 */
export async function getCourseStatistics(
  courseId: string
): Promise<{
  totalEnrollments: number;
  activeEnrollments: number;
  completionRate: number;
  averageScore: number;
  averageCompletionTime: number;
}> {
  try {
    // In production, calculate from enrollments and progress
    return {
      totalEnrollments: 0,
      activeEnrollments: 0,
      completionRate: 0,
      averageScore: 0,
      averageCompletionTime: 0,
    };
  } catch (error) {
    logger.error("Error fetching course statistics", { error, courseId });
    throw new Error("Failed to fetch statistics");
  }
}

/**
 * Get organization training statistics
 */
export async function getOrganizationStatistics(
  organizationId: string
): Promise<{
  totalCourses: number;
  activeCourses: number;
  totalEnrollments: number;
  averageCompletionRate: number;
  certificatesIssued: number;
  mandatoryComplianceRate: number;
}> {
  try {
    const courses = await listCourses({ organizationId, isActive: true });

    return {
      totalCourses: courses.total,
      activeCourses: courses.courses.filter(c => c.isActive).length,
      totalEnrollments: 0,
      averageCompletionRate: 0,
      certificatesIssued: 0,
      mandatoryComplianceRate: 0,
    };
  } catch (error) {
    logger.error("Error fetching organization statistics", { error, organizationId });
    throw new Error("Failed to fetch statistics");
  }
}

