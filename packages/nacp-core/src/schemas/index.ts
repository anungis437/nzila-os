/**
 * @nzila/nacp-core — Zod Validation Schemas
 *
 * API boundary validation for NACP exam management orgs.
 *
 * @module @nzila/nacp-core/schemas
 */
import { z } from 'zod'
import {
  ExamSessionStatus as _ExamSessionStatus,
  SubjectLevel,
  NacpRole,
} from '../enums'

// ── Helpers ─────────────────────────────────────────────────────────────────

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [string, ...string[]]

// ── Exam ────────────────────────────────────────────────────────────────────

export const CreateExamSchema = z.object({
  title: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  subjectId: z.guid(),
  level: z.enum(enumValues(SubjectLevel)),
  year: z.number().int().min(2000).max(2100),
  durationMinutes: z.number().int().min(1).max(720),
  totalMarks: z.number().int().min(1),
  passPercentage: z.number().min(0).max(100),
})

export type CreateExamInput = z.infer<typeof CreateExamSchema>

// ── Exam Session ────────────────────────────────────────────────────────────

export const CreateExamSessionSchema = z.object({
  examId: z.guid(),
  centerId: z.guid(),
  scheduledAt: z.string().datetime(),
})

export type CreateExamSessionInput = z.infer<typeof CreateExamSessionSchema>

// ── Subject ─────────────────────────────────────────────────────────────────

export const CreateSubjectSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  level: z.enum(enumValues(SubjectLevel)),
})

export type CreateSubjectInput = z.infer<typeof CreateSubjectSchema>

// ── Center ──────────────────────────────────────────────────────────────────

export const CreateCenterSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  province: z.string().min(1).max(255),
  district: z.string().min(1).max(255),
  capacity: z.number().int().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

export type CreateCenterInput = z.infer<typeof CreateCenterSchema>

// ── Candidate ───────────────────────────────────────────────────────────────

export const CreateCandidateSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  dateOfBirth: z.string().date(),
  gender: z.enum(['male', 'female']),
  centerId: z.guid(),
})

export type CreateCandidateInput = z.infer<typeof CreateCandidateSchema>

// ── Submission ──────────────────────────────────────────────────────────────

export const RecordSubmissionSchema = z.object({
  sessionId: z.guid(),
  candidateId: z.guid(),
  examId: z.guid(),
})

export type RecordSubmissionInput = z.infer<typeof RecordSubmissionSchema>

export const MarkSubmissionSchema = z.object({
  rawScore: z.number().min(0),
})

export type MarkSubmissionInput = z.infer<typeof MarkSubmissionSchema>

export const ModerateSubmissionSchema = z.object({
  moderatedScore: z.number().min(0),
})

export type ModerateSubmissionInput = z.infer<typeof ModerateSubmissionSchema>

// ── Org Context ─────────────────────────────────────────────────────────────

export const NacpOrgContextSchema = z.object({
  orgId: z.guid(),
  actorId: z.guid(),
  role: z.enum(enumValues(NacpRole)),
  permissions: z.array(z.string()),
  requestId: z.string().min(1),
})
