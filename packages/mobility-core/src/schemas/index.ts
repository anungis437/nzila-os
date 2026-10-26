/* ── Mobility OS – Zod Schemas (API boundary validation) ── */

import { z } from 'zod'
import {
  CASE_STATUSES,
  CASE_STAGES,
  PROGRAM_TYPES,
  INVESTMENT_TYPES,
  WEALTH_TIERS,
  RISK_PROFILES,
  ADVISOR_ROLES,
  TASK_TYPES,
  TASK_STATUSES,
  DOCUMENT_TYPES,
  VERIFICATION_STATUSES,
  COMPLIANCE_EVENT_TYPES,
  SEVERITY_LEVELS,
  FAMILY_RELATIONS,
  LICENSE_TYPES,
  COMMUNICATION_CHANNELS,
  MESSAGE_TYPES,
} from '../enums'

/* ── Primitives ───────────────────────────────────────────── */

export const uuidSchema = z.guid()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const countryCodeSchema = z.string().min(2).max(3)

/* ── Firm ──────────────────────────────────────────────────── */

export const createFirmSchema = z.object({
  name: z.string().min(1).max(300),
  jurisdiction: countryCodeSchema,
  licenseType: z.enum(LICENSE_TYPES),
})

/* ── Client ───────────────────────────────────────────────── */

export const createClientSchema = z.object({
  firmId: uuidSchema,
  hubspotContactId: z.string().nullable().default(null),
  primaryNationality: countryCodeSchema,
  residenceCountry: countryCodeSchema,
  wealthTier: z.enum(WEALTH_TIERS),
  riskProfile: z.enum(RISK_PROFILES),
})

/* ── Family Member ────────────────────────────────────────── */

export const createFamilyMemberSchema = z.object({
  clientId: uuidSchema,
  relation: z.enum(FAMILY_RELATIONS),
  nationality: countryCodeSchema,
  dob: z.coerce.date().nullable().default(null),
  passportExpiry: z.coerce.date().nullable().default(null),
})

/* ── Case ─────────────────────────────────────────────────── */

export const createCaseSchema = z.object({
  clientId: uuidSchema,
  advisorId: uuidSchema,
  programId: uuidSchema,
  hubspotDealId: z.string().nullable().default(null),
})

export const updateCaseStatusSchema = z.object({
  status: z.enum(CASE_STATUSES),
  stage: z.enum(CASE_STAGES).optional(),
})

/* ── Case Task ────────────────────────────────────────────── */

export const createCaseTaskSchema = z.object({
  caseId: uuidSchema,
  taskType: z.enum(TASK_TYPES),
  assignedTo: uuidSchema,
  dueDate: z.coerce.date().nullable().default(null),
})

export const updateTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
})

/* ── Document ─────────────────────────────────────────────── */

export const createDocumentSchema = z.object({
  caseId: uuidSchema,
  fileUrl: z.string().url(),
  sharepointUrl: z.string().url().nullable().default(null),
  documentType: z.enum(DOCUMENT_TYPES),
})

export const updateVerificationSchema = z.object({
  verificationStatus: z.enum(VERIFICATION_STATUSES),
})

/* ── Compliance Event ─────────────────────────────────────── */

export const createComplianceEventSchema = z.object({
  caseId: uuidSchema,
  eventType: z.enum(COMPLIANCE_EVENT_TYPES),
  severity: z.enum(SEVERITY_LEVELS),
  metadata: z.record(z.string(), z.unknown()).prefault({}),
})

/* ── Communication ────────────────────────────────────────── */

export const createCommunicationSchema = z.object({
  caseId: uuidSchema.nullable().default(null),
  clientId: uuidSchema,
  channel: z.enum(COMMUNICATION_CHANNELS),
  direction: z.enum(['inbound', 'outbound']),
  messageType: z.enum(MESSAGE_TYPES),
  subject: z.string().nullable().default(null),
  body: z.string().min(1),
  externalId: z.string().nullable().default(null),
})

/* ── Program Eligibility ──────────────────────────────────── */

export const clientProfileSchema = z.object({
  primaryNationality: countryCodeSchema,
  residenceCountry: countryCodeSchema,
  wealthTier: z.enum(WEALTH_TIERS),
  riskProfile: z.enum(RISK_PROFILES),
  familySize: z.number().int().min(0).default(0),
  investmentBudget: z.number().min(0).optional(),
  preferredRegions: z.array(countryCodeSchema).default([]),
  physicalPresenceOk: z.boolean().default(true),
})
